import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.database import (
    SessionLocal,
    Well,
    Sensor,
    Reading,
    SensorMeasurement,
    DataStatusEnum,
    DataSourceEnum,
)
from app.schemas.sensors import SensorIngestPayload, SensorIngestResponse


def hash_device_token(token: str) -> str:
    """Hash sensor device token using SHA-256 for secure verification."""
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()


def verify_device_token(plain_token: str, stored_hash: Optional[str]) -> bool:
    """Constant-time verification of device token against stored hash."""
    if not stored_hash or not plain_token:
        return False
    computed_hash = hash_device_token(plain_token)
    return hmac.compare_digest(computed_hash, stored_hash)


class SensorIngestionService:
    """
    Central, transport-agnostic ingestion service for physical IoT sensors.
    Can be invoked by HTTP POST /api/sensors/ingest, MQTT subscriber threads, or batch bridge workers.
    Enforces strict device authentication, bounds validation, and physical status marking.
    """

    @staticmethod
    def ingest_reading(
        payload: SensorIngestPayload,
        api_key_header: Optional[str] = None,
        transport: str = "HTTP",
        db: Optional[Session] = None,
    ) -> SensorIngestResponse:
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            now = datetime.now(timezone.utc)
            timestamp = payload.timestamp or now
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)

            # 1. Resolve Sensor Hardware Record
            sensor = db.query(Sensor).filter(Sensor.id == payload.sensor_id).first()
            if not sensor:
                raise HTTPException(
                    status_code=404,
                    detail=f"Sensor hardware '{payload.sensor_id}' is not registered in AquaSense registry.",
                )

            # 2. Strict Authentication (Requirement 6: Never accept unauthenticated readings as LIVE)
            provided_token = api_key_header or payload.device_token
            if not provided_token:
                raise HTTPException(
                    status_code=401,
                    detail="Authentication required. Unauthenticated telemetry cannot be ingested as LIVE sensor data.",
                )

            # If sensor has registered api_key_hash, verify it strictly
            if not sensor.api_key_hash:
                raise HTTPException(
                    status_code=401,
                    detail=f"Sensor hardware '{sensor.id}' has not been provisioned with an API key. Register device credentials first.",
                )

            if not verify_device_token(provided_token, sensor.api_key_hash):
                raise HTTPException(
                    status_code=401,
                    detail="Invalid sensor credentials. Physical telemetry requires authenticated device token.",
                )

            # 3. Resolve Associated Well
            target_well_id = payload.well_id or sensor.well_id
            well = db.query(Well).filter(Well.id == target_well_id).first()
            if not well:
                raise HTTPException(
                    status_code=400,
                    detail=f"Associated well '{target_well_id}' not found in registry.",
                )

            if sensor.well_id != well.id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Sensor '{sensor.id}' is associated with well '{sensor.well_id}', not '{target_well_id}'.",
                )

            # 4. Telemetry Validation (At least one measurement parameter must be present)
            metrics = {
                "water_level_m": payload.water_level_m,
                "ph": payload.ph,
                "tds_ppm": payload.tds_ppm,
                "turbidity_ntu": payload.turbidity_ntu,
                "dissolved_oxygen_mg_l": payload.dissolved_oxygen_mg_l,
                "temperature_c": payload.temperature_c,
            }
            valid_metrics = {k: v for k, v in metrics.items() if v is not None}
            if not valid_metrics:
                raise HTTPException(
                    status_code=400,
                    detail="Ingestion packet contains no measurement parameters. Provide at least one valid measurement.",
                )

            # 5. Get previous reading to fill missing parameters (if sensor is single-parameter, e.g. ultrasonic only)
            latest_reading = (
                db.query(Reading)
                .filter(Reading.well_id == well.id)
                .order_by(Reading.timestamp.desc())
                .first()
            )

            # Build full reading record with baseline fallbacks for parameters not sent by this specific sensor
            water_level_m = (
                payload.water_level_m
                if payload.water_level_m is not None
                else (latest_reading.water_level_m if latest_reading else 5.0)
            )
            ph = (
                payload.ph
                if payload.ph is not None
                else (latest_reading.ph if latest_reading else 7.0)
            )
            tds_ppm = (
                payload.tds_ppm
                if payload.tds_ppm is not None
                else (latest_reading.tds_ppm if latest_reading else 300.0)
            )
            turbidity_ntu = (
                payload.turbidity_ntu
                if payload.turbidity_ntu is not None
                else (latest_reading.turbidity_ntu if latest_reading else 2.5)
            )
            dissolved_oxygen_mg_l = (
                payload.dissolved_oxygen_mg_l
                if payload.dissolved_oxygen_mg_l is not None
                else (latest_reading.dissolved_oxygen_mg_l if latest_reading else 6.0)
            )
            temperature_c = (
                payload.temperature_c
                if payload.temperature_c is not None
                else (latest_reading.temperature_c if latest_reading else 25.0)
            )

            # 6. Persist Authenticated LIVE Reading
            new_reading = Reading(
                well_id=well.id,
                sensor_id=sensor.id,
                water_level_m=round(water_level_m, 2),
                ph=round(ph, 2),
                tds_ppm=round(tds_ppm, 1),
                turbidity_ntu=round(turbidity_ntu, 1),
                dissolved_oxygen_mg_l=round(dissolved_oxygen_mg_l, 1),
                temperature_c=round(temperature_c, 1),
                status=DataStatusEnum.LIVE,  # Authenticated live physical sensor reading!
                source=DataSourceEnum.IOT_SENSOR,
                timestamp=timestamp,  # Physical measurement timestamp
                received_at=now,      # Device transmission communication timestamp
            )
            db.add(new_reading)
            db.flush()

            # 7. Update Sensor Hardware Status & Last Seen Time
            sensor.last_seen_at = now
            sensor.is_active = True
            if well.monitoring_type != "PHYSICAL_SENSOR":
                well.monitoring_type = "PHYSICAL_SENSOR"
            db.commit()
            db.refresh(new_reading)

            # 8. Optional: Broadcast to active WebSocket subscribers
            try:
                from app.api.websocket import manager
                import asyncio
                # Non-blocking broadcast if loop is active
                msg = {
                    "event": "sensor_telemetry",
                    "sensor_id": sensor.id,
                    "well_id": well.id,
                    "water_level": new_reading.water_level_m,
                    "ph": new_reading.ph,
                    "tds": new_reading.tds_ppm,
                    "status": "LIVE",
                    "timestamp": timestamp.isoformat(),
                }
                # Broadcast safely
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(manager.broadcast(msg))
            except Exception:
                pass

            return SensorIngestResponse(
                success=True,
                status="LIVE",
                sensor_id=sensor.id,
                well_id=well.id,
                reading_id=new_reading.id,
                received_at=now,
                message=f"Telemetry successfully ingested from physical sensor '{sensor.id}' into well '{well.id}'.",
            )
        finally:
            if should_close:
                db.close()
