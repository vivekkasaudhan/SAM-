import secrets
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from sqlalchemy.orm import Session

from app.models.database import SessionLocal, Well, Sensor, Reading, User
from app.auth import get_current_user, get_current_admin, is_main_admin, get_db
from app.schemas.sensors import (
    SensorIngestPayload,
    SensorIngestResponse,
    SensorRegisterRequest,
    SensorDetailResponse,
)
from app.services.sensor_ingestion_service import (
    SensorIngestionService,
    hash_device_token,
)

router = APIRouter(prefix="/sensors", tags=["Sensors & IoT Ingestion"])


@router.post("/ingest", response_model=SensorIngestResponse, status_code=200)
def ingest_sensor_telemetry(
    payload: SensorIngestPayload,
    x_sensor_key: Optional[str] = Header(None, alias="X-Sensor-Key"),
    db: Session = Depends(get_db),
):
    """
    Validated telemetry ingestion endpoint for ESP32, Arduino, and cellular IoT microcontrollers.
    Requires device authentication (X-Sensor-Key header or device_token in payload).
    Validates physical parameters, updates hardware heartbeat, and stores persistent LIVE reading.
    Designed for reuse by MQTT background workers or direct HTTP POST requests.
    """
    return SensorIngestionService.ingest_reading(
        payload=payload,
        api_key_header=x_sensor_key,
        transport="HTTP",
        db=db,
    )


@router.get("", response_model=List[SensorDetailResponse])
def list_sensors(db: Session = Depends(get_db)):
    """List all registered physical and simulated sensors with their hardware status and last-seen telemetry."""
    sensors = db.query(Sensor).order_by(Sensor.installed_at.desc()).all()
    results = []
    now = datetime.now(timezone.utc)

    for s in sensors:
        latest = (
            db.query(Reading)
            .filter(Reading.sensor_id == s.id)
            .order_by(Reading.timestamp.desc())
            .first()
        )

        status_str = "UNINITIALIZED"
        if s.last_seen_at:
            last_seen = s.last_seen_at
            if last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
            diff_mins = (now - last_seen).total_seconds() / 60.0
            if diff_mins <= 30:
                status_str = "ONLINE"
            elif diff_mins <= 1440:
                status_str = "STALE"
            else:
                status_str = "OFFLINE"
        elif s.is_active:
            status_str = "SIMULATED_DEMO" if latest and latest.status.value == "SIMULATED" else "OFFLINE"

        latest_dict = None
        if latest:
            latest_dict = {
                "id": latest.id,
                "water_level_m": latest.water_level_m,
                "ph": latest.ph,
                "tds_ppm": latest.tds_ppm,
                "turbidity_ntu": latest.turbidity_ntu,
                "dissolved_oxygen_mg_l": latest.dissolved_oxygen_mg_l,
                "temperature_c": latest.temperature_c,
                "status": latest.status.value if hasattr(latest.status, "value") else latest.status,
                "source": latest.source.value if hasattr(latest.source, "value") else latest.source,
                "timestamp": latest.timestamp.isoformat() if latest.timestamp else None,
            }

        results.append(
            SensorDetailResponse(
                id=s.id,
                well_id=s.well_id,
                sensor_type=s.sensor_type,
                model=s.model,
                measurement_parameter=getattr(s, "measurement_parameter", "water_level,ph,tds,turbidity,dissolved_oxygen,temperature"),
                units=getattr(s, "units", "m,pH,ppm,NTU,mg/L,°C"),
                is_installed=getattr(s, "is_installed", True),
                is_active=s.is_active,
                status=status_str,
                data_source=getattr(s, "data_source", "IOT_SENSOR"),
                last_seen_at=s.last_seen_at,
                installed_at=s.installed_at,
                latest_reading=latest_dict,
            )
        )

    return results


@router.post("", response_model=Dict[str, Any], status_code=201)
def register_sensor(
    payload: SensorRegisterRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Protected endpoint to register a new physical hardware sensor, associate it with a well,
    and generate its secure device ingestion key.
    Main Admin can register sensors on any well; Subadmins only on wells they created.
    """
    # Check if well exists
    well = db.query(Well).filter(Well.id == payload.well_id).first()
    if not well:
        raise HTTPException(status_code=404, detail=f"Target well '{payload.well_id}' does not exist.")

    # Ownership / Authorization check
    if not is_main_admin(user):
        if well.created_by != user.id:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Subadmins can only register sensors on wells they created.",
            )

    # Check for duplicate sensor ID
    existing = db.query(Sensor).filter(Sensor.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Sensor ID '{payload.id}' is already registered.")

    # Generate or hash device token
    plain_api_key = payload.device_api_key or f"aqs_{secrets.token_hex(16)}"
    key_hash = hash_device_token(plain_api_key)

    new_sensor = Sensor(
        id=payload.id,
        well_id=payload.well_id,
        sensor_type=payload.sensor_type,
        model=payload.model,
        measurement_parameter=payload.measurement_parameter,
        units=payload.units,
        is_installed=payload.is_installed,
        is_active=True,
        api_key_hash=key_hash,
        data_source="IOT_SENSOR",
        installed_at=datetime.now(timezone.utc),
    )
    db.add(new_sensor)
    db.commit()
    db.refresh(new_sensor)

    return {
        "message": f"Sensor hardware '{payload.id}' successfully registered and provisioned for well '{payload.well_id}'.",
        "sensor_id": new_sensor.id,
        "well_id": new_sensor.well_id,
        "device_api_key": plain_api_key,
        "instruction": "Flash this device_api_key into the ESP32 firmware config. Use header 'X-Sensor-Key' when sending POST /api/sensors/ingest.",
    }


@router.get("/{sensor_id}/telemetry", response_model=List[Dict[str, Any]])
def get_sensor_telemetry(
    sensor_id: str,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Retrieve raw historical telemetry reported by a specific physical sensor."""
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor '{sensor_id}' not found.")

    readings = (
        db.query(Reading)
        .filter(Reading.sensor_id == sensor_id)
        .order_by(Reading.timestamp.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": r.id,
            "well_id": r.well_id,
            "sensor_id": r.sensor_id,
            "water_level_m": r.water_level_m,
            "ph": r.ph,
            "tds_ppm": r.tds_ppm,
            "turbidity_ntu": r.turbidity_ntu,
            "dissolved_oxygen_mg_l": r.dissolved_oxygen_mg_l,
            "temperature_c": r.temperature_c,
            "status": r.status.value if hasattr(r.status, "value") else r.status,
            "source": r.source.value if hasattr(r.source, "value") else r.source,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in readings
    ]


@router.delete("/{sensor_id}")
def delete_sensor(
    sensor_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Delete a registered sensor.
    Main Admin can delete any sensor; Subadmins only on wells they created.
    """
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor '{sensor_id}' not found.")

    well = db.query(Well).filter(Well.id == sensor.well_id).first()
    if not is_main_admin(user):
        if not well or well.created_by != user.id:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Subadmins can only delete sensors for wells they created.",
            )

    # Cascade delete readings attached to this sensor
    db.query(Reading).filter(Reading.sensor_id == sensor_id).delete()
    db.delete(sensor)
    db.commit()

    return {"message": f"Sensor '{sensor_id}' deleted successfully", "id": sensor_id}

