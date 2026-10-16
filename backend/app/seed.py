"""
Idempotent development-only database seed script for AquaSense.
Seeds demo monitoring wells and baseline simulated readings near NIT Jamshedpur.
Guards against execution in production or creating duplicate records.
"""

from datetime import datetime, timezone
import sys
from app.config import settings
from app.models.database import (
    SessionLocal,
    init_db,
    Well,
    Sensor,
    Reading,
    DataStatusEnum,
    DataSourceEnum,
)

DEMO_WELLS = [
    {
        "id": "WELL-NIT-01",
        "name": "NIT Jamshedpur Campus Monitoring Well 1",
        "latitude": 22.7772,
        "longitude": 86.1441,
        "country": "India",
        "state": "Jharkhand",
        "district": "East Singhbhum",
        "city": "Jamshedpur",
        "location_description": "Academic Complex, NIT Jamshedpur, Adityapur",
        "warning_level_m": 7.5,
        "danger_level_m": 8.5,
        "sensor": {
            "id": "SENSOR-WELL-01",
            "sensor_type": "Multi-Parameter Groundwater Sonde",
            "model": "SAM-Pro-Multi",
        },
        "reading": {
            "water_level_m": 6.8,
            "ph": 7.2,
            "tds_ppm": 340.0,
            "turbidity_ntu": 2.1,
            "dissolved_oxygen_mg_l": 6.5,
            "temperature_c": 26.0,
            "status": DataStatusEnum.SIMULATED,
            "source": DataSourceEnum.SYNTHETIC,
        },
    },
    {
        "id": "WELL-NIT-02",
        "name": "NIT Jamshedpur Riverfront Well 2",
        "latitude": 22.7845,
        "longitude": 86.1492,
        "country": "India",
        "state": "Jharkhand",
        "district": "East Singhbhum",
        "city": "Jamshedpur",
        "location_description": "Kharkai Riverfront Buffer, Near NIT Jamshedpur",
        "warning_level_m": 8.5,
        "danger_level_m": 9.5,
        "sensor": {
            "id": "SENSOR-WELL-02",
            "sensor_type": "Multi-Parameter Groundwater Sonde",
            "model": "SAM-Pro-Multi",
        },
        "reading": {
            "water_level_m": 8.1,
            "ph": 6.8,
            "tds_ppm": 420.0,
            "turbidity_ntu": 3.4,
            "dissolved_oxygen_mg_l": 5.8,
            "temperature_c": 27.0,
            "status": DataStatusEnum.SIMULATED,
            "source": DataSourceEnum.SYNTHETIC,
        },
    },
]


def seed_demo_wells(force: bool = False) -> bool:
    """
    Seed development demo wells near NIT Jamshedpur idempotently.
    Returns True if seeded or already present, False if blocked by environment.
    """
    env = (settings.environment or "development").lower()
    if env == "production" and not force:
        print("[SEED NOTICE] Skipping demo well seeding in production environment.")
        return False

    # Ensure tables exist
    init_db()

    session = SessionLocal()
    try:
        wells_created = 0
        readings_created = 0

        for well_data in DEMO_WELLS:
            well_id = well_data["id"]
            existing_well = session.query(Well).filter(Well.id == well_id).first()

            if not existing_well:
                new_well = Well(
                    id=well_id,
                    name=well_data["name"],
                    latitude=well_data["latitude"],
                    longitude=well_data["longitude"],
                    country=well_data.get("country", "India"),
                    state=well_data.get("state"),
                    district=well_data.get("district"),
                    city=well_data.get("city"),
                    location_description=well_data["location_description"],
                    warning_level_m=well_data["warning_level_m"],
                    danger_level_m=well_data["danger_level_m"],
                    monitoring_type="SIMULATED",
                    is_active=True,
                )
                session.add(new_well)
                session.flush()

                sensor_info = well_data["sensor"]
                new_sensor = Sensor(
                    id=sensor_info["id"],
                    well_id=well_id,
                    sensor_type=sensor_info["sensor_type"],
                    model=sensor_info["model"],
                    is_active=True,
                )
                session.add(new_sensor)
                session.flush()

                reading_info = well_data["reading"]
                new_reading = Reading(
                    well_id=well_id,
                    sensor_id=sensor_info["id"],
                    water_level_m=reading_info["water_level_m"],
                    ph=reading_info["ph"],
                    tds_ppm=reading_info["tds_ppm"],
                    turbidity_ntu=reading_info["turbidity_ntu"],
                    dissolved_oxygen_mg_l=reading_info["dissolved_oxygen_mg_l"],
                    temperature_c=reading_info["temperature_c"],
                    status=reading_info["status"],
                    source=reading_info["source"],
                    timestamp=datetime.now(timezone.utc),
                )
                session.add(new_reading)
                wells_created += 1
                readings_created += 1
            else:
                # Update existing demo well's geographic metadata and monitoring type
                existing_well.country = well_data.get("country", "India")
                existing_well.state = well_data.get("state")
                existing_well.district = well_data.get("district")
                existing_well.city = well_data.get("city")
                existing_well.monitoring_type = "SIMULATED"
                sensor_info = well_data["sensor"]
                existing_sensor = (
                    session.query(Sensor)
                    .filter(Sensor.id == sensor_info["id"])
                    .first()
                )
                if not existing_sensor:
                    new_sensor = Sensor(
                        id=sensor_info["id"],
                        well_id=well_id,
                        sensor_type=sensor_info["sensor_type"],
                        model=sensor_info["model"],
                        is_active=True,
                    )
                    session.add(new_sensor)
                    session.flush()

                # If force/reset requested or readings missing, regenerate full 24-hour persistent historical readings
                reading_count = (
                    session.query(Reading).filter(Reading.well_id == well_id).count()
                )
                if force or reading_count < 24:
                    import math
                    from datetime import timedelta
                    # Remove any existing readings and generate 24 deterministic hourly records
                    session.query(Reading).filter(Reading.well_id == well_id).delete()
                    now = datetime.now(timezone.utc)
                    reading_info = well_data["reading"]
                    for h in range(23, -1, -1):
                        t = now - timedelta(hours=h)
                        # Sinusoidal offset anchored so at h=0 (latest), offset is exactly 0.0
                        osc = math.sin(2 * math.pi * h / 24)
                        wl = round(max(0.5, reading_info["water_level_m"] - 0.22 * osc), 2)
                        ph = round(max(5.5, min(9.5, reading_info["ph"] + 0.12 * osc)), 2)
                        tds = round(max(50.0, reading_info["tds_ppm"] + 14.0 * osc), 1)
                        turb = round(max(0.5, reading_info["turbidity_ntu"] + 0.3 * osc), 1)
                        do = round(max(1.0, reading_info["dissolved_oxygen_mg_l"] + 0.35 * osc), 1)
                        temp = round(reading_info["temperature_c"] - 1.2 * osc, 1)

                        r = Reading(
                            well_id=well_id,
                            sensor_id=sensor_info["id"],
                            water_level_m=wl,
                            ph=ph,
                            tds_ppm=tds,
                            turbidity_ntu=turb,
                            dissolved_oxygen_mg_l=do,
                            temperature_c=temp,
                            status=reading_info["status"],
                            source=reading_info["source"],
                            timestamp=t,
                        )
                        session.add(r)
                        readings_created += 1

        session.commit()
        print(
            f"[SEED SUCCESS] Seed process completed. Created {wells_created} new wells, {readings_created} initial readings."
        )
        return True
    except Exception as e:
        session.rollback()
        print(f"[SEED ERROR] Seeding failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    force_seed = "--force" in sys.argv or "--reset" in sys.argv
    seed_demo_wells(force=force_seed)
