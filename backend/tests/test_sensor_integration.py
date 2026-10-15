import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.database import Base, Well, Sensor, Reading, DataStatusEnum, DataSourceEnum
from app.auth import get_db, hash_password
from app.services.sensor_ingestion_service import hash_device_token

client = TestClient(app)


def test_unauthenticated_ingestion_rejected():
    """Requirement 6: Never accept unauthenticated readings as LIVE."""
    payload = {
        "sensor_id": "SENSOR-WELL-01",
        "water_level_m": 7.15,
        "ph": 7.4,
    }
    # No token provided
    res = client.post("/api/sensors/ingest", json=payload)
    assert res.status_code == 401
    assert "Authentication required" in res.json()["detail"]


def test_invalid_token_ingestion_rejected():
    """Requirement 6: Reject invalid tokens."""
    payload = {
        "sensor_id": "SENSOR-WELL-01",
        "device_token": "invalid_wrong_token",
        "water_level_m": 7.15,
    }
    res = client.post("/api/sensors/ingest", json=payload)
    assert res.status_code == 401


def test_demo_wells_remain_simulated():
    """Requirement 6 & 7: Do not claim physical sensors are connected for demo wells. Keep SIMULATED."""
    res = client.get("/api/wells/WELL-NIT-01")
    assert res.status_code == 200
    data = res.json()
    assert data["latest_reading"]["status"] == "SIMULATED"
    assert data["parameter_sources"]["water_level"]["status"] == "SIMULATED"

    res2 = client.get("/api/wells/WELL-NIT-02")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["latest_reading"]["status"] == "SIMULATED"
    assert data2["parameter_sources"]["water_level"]["status"] == "SIMULATED"


def test_sensor_registration_and_authenticated_ingestion():
    """Requirement 4 & 5: Support authenticated device ingestion, parameter validation, and LIVE marking."""
    # 1. Login as admin to register a new test well and sensor
    login_res = client.post("/api/auth/login", json={
        "username_or_email": "admin",
        "password": "AdminAquaSense@2026",
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create isolated test well
    well_create_res = client.post("/api/wells", json={
        "name": "Live Test Ingestion Well",
        "latitude": 22.8123,
        "longitude": 86.2345,
        "warning_level_m": 7.5,
        "danger_level_m": 8.5,
    }, headers=headers)
    assert well_create_res.status_code == 201
    test_well_id = well_create_res.json()["id"]

    sensor_id = "SENSOR-TEST-ESP32-LIVE"
    api_key = "aqs_live_secret_key_12345"

    try:
        # 3. Register hardware sensor for test well
        reg_res = client.post("/api/sensors", json={
            "id": sensor_id,
            "well_id": test_well_id,
            "sensor_type": "Ultrasonic & Water Quality Probe",
            "model": "ESP32-AquaSense-v3",
            "measurement_parameter": "water_level,ph,tds,turbidity,temperature",
            "units": "m,pH,ppm,NTU,°C",
            "is_installed": True,
            "device_api_key": api_key,
        }, headers=headers)
        assert reg_res.status_code == 201
        assert reg_res.json()["sensor_id"] == sensor_id

        # 4. Ingest authenticated physical telemetry with X-Sensor-Key
        ingest_res = client.post(
            "/api/sensors/ingest",
            json={
                "sensor_id": sensor_id,
                "water_level_m": 6.92,
                "ph": 7.35,
                "tds_ppm": 348.0,
                "turbidity_ntu": 1.9,
                "temperature_c": 25.8,
            },
            headers={"X-Sensor-Key": api_key},
        )
        assert ingest_res.status_code == 200
        res_data = ingest_res.json()
        assert res_data["success"] is True
        assert res_data["status"] == "LIVE"
        assert res_data["well_id"] == test_well_id

        # 5. Verify test well now reflects the LIVE physical reading
        well_res = client.get(f"/api/wells/{test_well_id}")
        assert well_res.status_code == 200
        well_data = well_res.json()
        assert well_data["latest_reading"]["water_level_m"] == 6.92
        assert well_data["latest_reading"]["ph"] == 7.35
        assert well_data["latest_reading"]["status"] == "LIVE"
        assert well_data["latest_reading"]["source"] == "IOT_SENSOR"

        # 6. Verify sensor telemetry history
        hist_res = client.get(f"/api/sensors/{sensor_id}/telemetry")
        assert hist_res.status_code == 200
        hist_data = hist_res.json()
        assert len(hist_data) >= 1
        assert hist_data[0]["status"] == "LIVE"
        assert hist_data[0]["water_level_m"] == 6.92
    finally:
        # Cleanup test well, sensor, and readings so DB remains pristine
        from app.models.database import SessionLocal
        db = SessionLocal()
        try:
            db.query(Reading).filter(Reading.well_id == test_well_id).delete()
            db.query(Sensor).filter(Sensor.id == sensor_id).delete()
            db.query(Well).filter(Well.id == test_well_id).delete()
            db.commit()
        finally:
            db.close()


def test_sensors_list_endpoint():
    """Verify GET /api/sensors lists registered hardware and installation attributes."""
    res = client.get("/api/sensors")
    assert res.status_code == 200
    sensors = res.json()
    assert len(sensors) >= 1
    sensor_ids = [s["id"] for s in sensors]
    assert "SENSOR-WELL-01" in sensor_ids
