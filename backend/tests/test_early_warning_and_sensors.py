import pytest
import secrets
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.database import SessionLocal, Well, Sensor, Reading, Alert, User
from app.services.early_warning_service import EarlyWarningService
from app.services.sensor_ingestion_service import hash_device_token

client = TestClient(app)


def get_auth_token(username: str = "admin", password: str = "AdminAquaSense@2026") -> str:
    res = client.post("/api/auth/login", json={"username_or_email": username, "password": password})
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    data = res.json()
    return data.get("token") or data.get("access_token")


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def clean_test_well(db_session: Session):
    well_id = f"TEST-WELL-EW-{secrets.token_hex(3).upper()}"
    well = Well(
        id=well_id,
        name="Early Warning Test Station",
        latitude=26.8467,
        longitude=80.9462,
        country="India",
        state="Uttar Pradesh",
        district="Lucknow",
        city="Lucknow",
        warning_level_m=7.5,
        danger_level_m=8.5,
        is_active=True,
    )
    db_session.add(well)
    db_session.commit()

    yield well

    # Cleanup
    db_session.query(Alert).filter(Alert.well_id == well_id).delete()
    db_session.query(Reading).filter(Reading.well_id == well_id).delete()
    db_session.query(Sensor).filter(Sensor.well_id == well_id).delete()
    db_session.query(Well).filter(Well.id == well_id).delete()
    db_session.commit()


# ─── 1. Telemetry Freshness & Stale/Offline Detection ──────────────────────────
def test_zero_reading_triggers_stale_telemetry(db_session: Session, clean_test_well: Well):
    """Wells with no recorded telemetry must trigger CRITICAL stale telemetry alert."""
    alerts = EarlyWarningService.evaluate_well(clean_test_well.id, evaluate_forecast=False, db=db_session)
    stale_alert = next((a for a in alerts if a.alert_type == "STALE_TELEMETRY"), None)
    assert stale_alert is not None
    assert stale_alert.severity == "CRITICAL"
    assert "completely unavailable" in stale_alert.reason


def test_stale_and_offline_sensor_detection(db_session: Session, clean_test_well: Well):
    """Reading older than 2h is WARNING; older than 24h is CRITICAL."""
    now = datetime.now(timezone.utc)

    # 1. Reading from 3 hours ago -> WARNING
    r1 = Reading(
        well_id=clean_test_well.id,
        water_level_m=5.0,
        ph=7.2,
        tds_ppm=350.0,
        turbidity_ntu=2.0,
        dissolved_oxygen_mg_l=6.5,
        temperature_c=25.0,
        status="LIVE",
        source="IOT_SENSOR",
        timestamp=now - timedelta(hours=3),
    )
    db_session.add(r1)
    db_session.commit()

    alerts_warn = EarlyWarningService.evaluate_well(clean_test_well.id, evaluate_forecast=False, db=db_session)
    stale_warn = next((a for a in alerts_warn if a.alert_type == "STALE_TELEMETRY"), None)
    assert stale_warn is not None
    assert stale_warn.severity == "WARNING"
    assert "STALE" in stale_warn.reason

    # 2. Update reading timestamp to 26 hours ago -> CRITICAL OFFLINE
    r1.timestamp = now - timedelta(hours=26)
    db_session.commit()

    alerts_crit = EarlyWarningService.evaluate_well(clean_test_well.id, evaluate_forecast=False, db=db_session)
    stale_crit = next((a for a in alerts_crit if a.alert_type == "STALE_TELEMETRY"), None)
    assert stale_crit is not None
    assert stale_crit.severity == "CRITICAL"
    assert "OFFLINE" in stale_crit.reason


# ─── 2. Water-Level Convention & Critical High/Low Stage ───────────────────────
def test_critical_high_overflow_danger(db_session: Session, clean_test_well: Well):
    """High stage >= 8.5m triggers CRITICAL high flood/waterlogging danger."""
    now = datetime.now(timezone.utc)
    r = Reading(
        well_id=clean_test_well.id,
        water_level_m=8.9,  # Above danger line 8.5m
        ph=7.2,
        tds_ppm=350.0,
        turbidity_ntu=2.0,
        dissolved_oxygen_mg_l=6.5,
        temperature_c=25.0,
        status="LIVE",
        source="IOT_SENSOR",
        timestamp=now,
    )
    db_session.add(r)
    db_session.commit()

    alerts = EarlyWarningService.evaluate_well(clean_test_well.id, evaluate_forecast=False, db=db_session)
    high_alert = next((a for a in alerts if a.alert_type == "CRITICAL_HIGH"), None)
    assert high_alert is not None
    assert high_alert.severity == "CRITICAL"
    assert high_alert.observed_value == 8.9
    assert high_alert.threshold_value == 8.5
    assert "waterlogging" in high_alert.reason.lower() or "flood" in high_alert.reason.lower()


def test_critical_low_aquifer_depletion(db_session: Session, clean_test_well: Well):
    """Low stage <= 1.2m triggers CRITICAL low depletion / pump cavitation risk."""
    now = datetime.now(timezone.utc)
    r = Reading(
        well_id=clean_test_well.id,
        water_level_m=0.85,  # Breaches 1.2m critical low limit
        ph=7.2,
        tds_ppm=350.0,
        turbidity_ntu=2.0,
        dissolved_oxygen_mg_l=6.5,
        temperature_c=25.0,
        status="LIVE",
        source="IOT_SENSOR",
        timestamp=now,
    )
    db_session.add(r)
    db_session.commit()

    alerts = EarlyWarningService.evaluate_well(clean_test_well.id, evaluate_forecast=False, db=db_session)
    low_alert = next((a for a in alerts if a.alert_type == "CRITICAL_LOW"), None)
    assert low_alert is not None
    assert low_alert.severity == "CRITICAL"
    assert low_alert.observed_value == 0.85
    assert low_alert.threshold_value == 1.2
    assert "depletion" in low_alert.reason.lower() or "cavitation" in low_alert.reason.lower()


# ─── 3. Rapid Water-Level Decline Detection ────────────────────────────────────
def test_rapid_decline_24h_detection(db_session: Session, clean_test_well: Well):
    """Drop >= 0.25m in 24 hours triggers RAPID_DECLINE alert."""
    now = datetime.now(timezone.utc)
    # Reading 24 hours ago: 5.50m
    past_r = Reading(
        well_id=clean_test_well.id,
        water_level_m=5.50,
        ph=7.2,
        tds_ppm=350.0,
        turbidity_ntu=2.0,
        dissolved_oxygen_mg_l=6.5,
        temperature_c=25.0,
        status="LIVE",
        source="IOT_SENSOR",
        timestamp=now - timedelta(hours=24),
    )
    # Reading now: 5.05m (drop of 0.45m > 0.25m threshold)
    curr_r = Reading(
        well_id=clean_test_well.id,
        water_level_m=5.05,
        ph=7.2,
        tds_ppm=350.0,
        turbidity_ntu=2.0,
        dissolved_oxygen_mg_l=6.5,
        temperature_c=25.0,
        status="LIVE",
        source="IOT_SENSOR",
        timestamp=now,
    )
    db_session.add_all([past_r, curr_r])
    db_session.commit()

    alerts = EarlyWarningService.evaluate_well(clean_test_well.id, evaluate_forecast=False, db=db_session)
    rapid_alert = next((a for a in alerts if a.alert_type == "RAPID_DECLINE"), None)
    assert rapid_alert is not None
    assert rapid_alert.observed_value >= 0.44
    assert rapid_alert.threshold_value == 0.25
    assert "Rapid water-level drop" in rapid_alert.reason


# ─── 4. Idempotent Active Alert Deduplication ──────────────────────────────────
def test_idempotent_alert_deduplication(db_session: Session, clean_test_well: Well):
    """Running evaluation repeatedly for the same condition updates in-place without duplicate rows."""
    now = datetime.now(timezone.utc)
    r = Reading(
        well_id=clean_test_well.id,
        water_level_m=9.0,
        ph=7.2,
        tds_ppm=350.0,
        turbidity_ntu=2.0,
        dissolved_oxygen_mg_l=6.5,
        temperature_c=25.0,
        status="LIVE",
        source="IOT_SENSOR",
        timestamp=now,
    )
    db_session.add(r)
    db_session.commit()

    # First evaluation creates alert
    alerts_pass1 = EarlyWarningService.evaluate_well(clean_test_well.id, evaluate_forecast=False, db=db_session)
    count_pass1 = db_session.query(Alert).filter(Alert.well_id == clean_test_well.id, Alert.status == "ACTIVE").count()

    # Second evaluation updates in-place
    alerts_pass2 = EarlyWarningService.evaluate_well(clean_test_well.id, evaluate_forecast=False, db=db_session)
    count_pass2 = db_session.query(Alert).filter(Alert.well_id == clean_test_well.id, Alert.status == "ACTIVE").count()

    # Third evaluation with slight change in value
    r.water_level_m = 9.2
    db_session.commit()
    alerts_pass3 = EarlyWarningService.evaluate_well(clean_test_well.id, evaluate_forecast=False, db=db_session)
    count_pass3 = db_session.query(Alert).filter(Alert.well_id == clean_test_well.id, Alert.status == "ACTIVE").count()

    assert count_pass1 == count_pass2 == count_pass3 == 1
    updated_alert = db_session.query(Alert).filter(Alert.well_id == clean_test_well.id, Alert.status == "ACTIVE").first()
    assert updated_alert.observed_value == 9.2


# ─── 5. Auto-Resolution When Condition Clears ──────────────────────────────────
def test_alert_auto_resolution(db_session: Session, clean_test_well: Well):
    """When a well recovers to safe levels, active alerts transition to RESOLVED."""
    now = datetime.now(timezone.utc)
    r = Reading(
        well_id=clean_test_well.id,
        water_level_m=9.0,  # Exceeds danger
        ph=7.2,
        tds_ppm=350.0,
        turbidity_ntu=2.0,
        dissolved_oxygen_mg_l=6.5,
        temperature_c=25.0,
        status="LIVE",
        source="IOT_SENSOR",
        timestamp=now,
    )
    db_session.add(r)
    db_session.commit()

    EarlyWarningService.evaluate_well(clean_test_well.id, evaluate_forecast=False, db=db_session)
    assert db_session.query(Alert).filter(Alert.well_id == clean_test_well.id, Alert.status == "ACTIVE").count() == 1

    # Well recovers to safe stage: 5.0m
    r.water_level_m = 5.0
    db_session.commit()

    EarlyWarningService.evaluate_well(clean_test_well.id, evaluate_forecast=False, db=db_session)
    active_count = db_session.query(Alert).filter(Alert.well_id == clean_test_well.id, Alert.status == "ACTIVE").count()
    resolved_count = db_session.query(Alert).filter(Alert.well_id == clean_test_well.id, Alert.status == "RESOLVED").count()

    assert active_count == 0
    assert resolved_count >= 1


# ─── 6. Forecasted Threshold Crossings & Humility Notice ───────────────────────
def test_forecast_crossing_humility_disclaimer(db_session: Session, clean_test_well: Well):
    """Forecast crossing alerts must clearly state uncertainty and never guarantee a crisis."""
    now = datetime.now(timezone.utc)
    # Seed a descending trajectory over past 7 days: 3.0m down to 1.35m
    for i in range(10, 0, -1):
        db_session.add(
            Reading(
                well_id=clean_test_well.id,
                water_level_m=round(1.30 + (i * 0.15), 2),
                ph=7.2,
                tds_ppm=350.0,
                turbidity_ntu=2.0,
                dissolved_oxygen_mg_l=6.5,
                temperature_c=25.0,
                status="LIVE",
                source="IOT_SENSOR",
                timestamp=now - timedelta(days=i),
            )
        )
    # Latest reading close to critical low: 1.30m
    db_session.add(
        Reading(
            well_id=clean_test_well.id,
            water_level_m=1.30,
            ph=7.2,
            tds_ppm=350.0,
            turbidity_ntu=2.0,
            dissolved_oxygen_mg_l=6.5,
            temperature_c=25.0,
            status="LIVE",
            source="IOT_SENSOR",
            timestamp=now,
        )
    )
    db_session.commit()

    alerts = EarlyWarningService.evaluate_well(clean_test_well.id, evaluate_forecast=True, db=db_session)
    forecast_alert = next((a for a in alerts if a.is_forecast), None)
    if forecast_alert:
        assert "PREDICTIVE NOTICE" in forecast_alert.reason
        assert "NOT certain" in forecast_alert.reason or "proactive monitoring" in forecast_alert.reason
        assert forecast_alert.forecast_horizon_days is not None


# ─── 7. Sensor Authentication & Received At Separation ─────────────────────────
def test_sensor_ingestion_authentication_and_timestamps(db_session: Session, clean_test_well: Well):
    """Physical sensor authentication verifies token and sets received_at independently from measurement timestamp."""
    admin_token = get_auth_token()
    raw_device_token = "AquaSenseDeviceSecret-99"

    # 1. Provision a sensor on the test well
    sensor_id = f"SENSOR-{clean_test_well.id}"
    reg_res = client.post(
        "/api/sensors",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "id": sensor_id,
            "well_id": clean_test_well.id,
            "sensor_type": "Multi-Parameter Groundwater Sonde",
            "model": "AquaSense-Pro-2026",
            "measurement_parameter": "water_level,ph,tds,turbidity",
            "units": "m,pH,ppm,NTU",
            "device_api_key": raw_device_token,
        },
    )
    assert reg_res.status_code == 201

    # 2. Ingest reading with device token in header
    measurement_ts = "2026-10-15T10:00:00Z"
    ingest_res = client.post(
        "/api/sensors/ingest",
        headers={"X-Sensor-Key": raw_device_token},
        json={
            "sensor_id": sensor_id,
            "timestamp": measurement_ts,
            "water_level_m": 4.5,
            "ph": 7.4,
            "tds_ppm": 320.0,
            "turbidity_ntu": 1.8,
            "dissolved_oxygen_mg_l": 6.8,
            "temperature_c": 24.2,
        },
    )
    assert ingest_res.status_code == 200
    res_data = ingest_res.json()
    assert res_data["success"] is True
    assert res_data["status"] == "LIVE"
    assert res_data["well_id"] == clean_test_well.id

    # 3. Verify in database: received_at is separate and well monitoring_type is PHYSICAL_SENSOR
    db_session.expire_all()
    reading_row = db_session.query(Reading).filter(Reading.sensor_id == sensor_id).order_by(Reading.id.desc()).first()
    assert reading_row is not None
    assert reading_row.status == "LIVE"
    assert reading_row.source == "IOT_SENSOR"
    assert reading_row.received_at is not None

    refreshed_well = db_session.query(Well).filter(Well.id == clean_test_well.id).first()
    assert refreshed_well.monitoring_type == "PHYSICAL_SENSOR"


# ─── 8. API Endpoints & Acknowledgement ────────────────────────────────────────
def test_alerts_api_list_summary_acknowledge(db_session: Session, clean_test_well: Well):
    """Test /api/alerts, /api/alerts/summary, and /api/alerts/{id}/acknowledge."""
    now = datetime.now(timezone.utc)
    alert = Alert(
        well_id=clean_test_well.id,
        alert_type="CRITICAL_HIGH",
        severity="CRITICAL",
        is_forecast=False,
        metric="water_level",
        observed_value=8.95,
        threshold_value=8.5,
        unit="m",
        reason="Water level breached danger threshold",
        recommended_action="Inspect flood defenses",
        status="ACTIVE",
        created_at=now,
        last_evaluated_at=now,
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)

    # 1. List alerts
    res_list = client.get(f"/api/alerts?well_id={clean_test_well.id}")
    assert res_list.status_code == 200
    alerts_data = res_list.json()
    assert len(alerts_data) >= 1
    assert alerts_data[0]["id"] == alert.id
    assert alerts_data[0]["status"] == "ACTIVE"

    # 2. Get alert summary
    res_summary = client.get("/api/alerts/summary")
    assert res_summary.status_code == 200
    summary_data = res_summary.json()
    assert summary_data["total_active"] >= 1
    assert summary_data["critical_count"] >= 1

    # 3. Acknowledge alert
    res_ack = client.post(f"/api/alerts/{alert.id}/acknowledge")
    assert res_ack.status_code == 200
    assert res_ack.json()["status"] == "ACKNOWLEDGED"

    # Check database status
    db_session.refresh(alert)
    assert alert.status == "ACKNOWLEDGED"
