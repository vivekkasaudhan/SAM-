import math
import hashlib
import logging
from random import Random
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.database import SessionLocal, Well, Reading, DataStatusEnum, DataSourceEnum
from app.services.scheduler_service import simulation_scheduler

logger = logging.getLogger("aquasense.historical_simulation")


class HistoricalSimulationService:
    """
    High-fidelity, deterministic 3-year historical simulated data generator for AquaSense.
    
    Guarantees:
    1. Realistic Hydrological Dynamics:
       - Multi-year seasonal monsoon cycles (Indian hydrological rhythm: monsoon peak in late Sept/Oct, summer trough in May/June).
       - Inter-annual climatic recharge fluctuations.
       - Hydrochemical consistency (TDS dilution during rainfall, turbidity runoff spikes, seasonal thermal lag).
    2. Zero Fabrication on Physical Hardware:
       - Strictly verifies well eligibility (`monitoring_type == 'SIMULATED'`).
       - Blocks any well with provisioned hardware sensors or live telemetry.
    3. Reproducible & Seeded:
       - Generator uses a stable cryptographic hash of well characteristics (`well.id`, coordinates, name).
       - Repeated backfill runs produce identical deterministic readings.
    4. Idempotent & Non-Destructive:
       - Checks existing timestamps in database before inserting.
       - Never overwrites or deletes existing records, real sensor observations, or 5-minute scheduled readings.
    5. Adaptive Multi-Resolution Sampling:
       - Days -1095 to -14 (older history): 1 daily sample at 12:00 UTC (~1,081 readings per well).
       - Days -14 to 0 (recent history): 1 hourly sample (~336 readings per well).
       - Preserves database performance and keeps storage footprint lightweight (~1,400 rows/well).
    6. Explicit Provenance:
       - Every record is explicitly tagged with `status='SIMULATED'` and `source='SYNTHETIC'`.
    """

    DEFAULT_SPAN_DAYS = 1095  # 3 Years
    HOURLY_WINDOW_DAYS = 14   # Recent 14 days sampled hourly; older history sampled daily at 12:00 UTC

    @classmethod
    def is_well_eligible_for_backfill(cls, well: Well, db: Session) -> bool:
        """
        Check if well qualifies for historical demo simulation.
        Reuses SimulationScheduler eligibility policy.
        """
        return simulation_scheduler.is_well_eligible_for_simulation(well, db)

    @classmethod
    def backfill_well_history(
        cls,
        well_id: str,
        span_days: int = DEFAULT_SPAN_DAYS,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Idempotent backfill of 3-year historical simulated data for a single eligible well.
        """
        session = db or SessionLocal()
        should_close = db is None

        try:
            well = session.query(Well).filter(Well.id == well_id).first()
            if not well:
                raise ValueError(f"Well station '{well_id}' not found.")

            if not cls.is_well_eligible_for_backfill(well, session):
                return {
                    "well_id": well_id,
                    "status": "SKIPPED_INELIGIBLE",
                    "reason": f"Well '{well_id}' is configured for physical sensors or has live telemetry.",
                    "readings_created": 0,
                }

            now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
            start_date = now - timedelta(days=span_days)

            # Query existing timestamps for this well to prevent any duplicates
            existing_rows = (
                session.query(Reading.timestamp)
                .filter(Reading.well_id == well_id)
                .all()
            )
            # Store timestamps truncated to minute
            existing_ts_set: Set[str] = set()
            for row in existing_rows:
                ts = row[0]
                if ts:
                    ts_str = ts.strftime("%Y-%m-%d %H:%M")
                    existing_ts_set.add(ts_str)

            # Generate candidate time points
            candidate_timestamps: List[datetime] = []

            for d in range(span_days, -1, -1):
                day_base = (now - timedelta(days=d)).date()
                if d > cls.HOURLY_WINDOW_DAYS:
                    # Daily noon reading
                    dt = datetime(day_base.year, day_base.month, day_base.day, 12, 0, 0, tzinfo=timezone.utc)
                    if dt.strftime("%Y-%m-%d %H:%M") not in existing_ts_set:
                        candidate_timestamps.append(dt)
                else:
                    # Hourly readings for recent 14 days
                    for h in range(24):
                        dt = datetime(day_base.year, day_base.month, day_base.day, h, 0, 0, tzinfo=timezone.utc)
                        if dt.strftime("%Y-%m-%d %H:%M") not in existing_ts_set:
                            candidate_timestamps.append(dt)

            if not candidate_timestamps:
                return {
                    "well_id": well_id,
                    "status": "UP_TO_DATE",
                    "message": "Historical records already exist across the requested period; 0 new records needed.",
                    "readings_created": 0,
                }

            # Stable seed per well
            seed_key = f"{well.id}-{well.name}-{well.latitude:.4f}-{well.longitude:.4f}"
            well_seed = int(hashlib.sha256(seed_key.encode()).hexdigest()[:8], 16)

            # Well-specific baseline water level based on configured thresholds
            warning_lvl = well.warning_level_m if well.warning_level_m is not None else 7.5
            danger_lvl = well.danger_level_m if well.danger_level_m is not None else 8.5
            target_mid_wl = max(2.5, min(5.5, warning_lvl * 0.60))
            season_amp = max(0.6, min(1.3, warning_lvl * 0.16))

            readings_to_insert: List[Reading] = []

            for ts in candidate_timestamps:
                # Deterministic random generator for this specific day
                day_offset = int(ts.timestamp() // 86400)
                rng = Random(well_seed + day_offset)

                d_year = ts.timetuple().tm_yday
                # Annual seasonal sinusoidal (Monsoon peak around late Sept day ~265; summer trough day ~145)
                season_factor = -math.cos(2.0 * math.pi * (d_year - 265.0) / 365.25)

                # Multi-year climatic variation (interannual variation between wet and dry years)
                year_fraction = ts.year + (d_year / 365.25)
                climatic_variation = 0.25 * math.sin(2.0 * math.pi * (year_fraction - 2023.5) / 2.8)

                # Monsoon precipitation events (July to September: days 180 to 275)
                rain_mm = 0.0
                if 180 <= d_year <= 275:
                    if rng.random() < 0.26:
                        rain_mm = round(15.0 + (rng.random() * 45.0), 1)

                recharge_pulse = rain_mm * 0.007

                # Diurnal variation if hourly
                diurnal_m = 0.0
                if ts.hour != 12:
                    diurnal_m = 0.06 * math.sin(2.0 * math.pi * (ts.hour - 6) / 24.0)

                # Micro-noise
                micro_noise = (rng.random() - 0.5) * 0.04

                # Compute water level
                raw_wl = (
                    target_mid_wl
                    + (season_amp * season_factor)
                    + climatic_variation
                    + recharge_pulse
                    + diurnal_m
                    + micro_noise
                )
                # Keep strictly inside safe hydrological bounds (above 1.4m and below danger_lvl - 0.5m)
                water_level_m = round(max(1.4, min(danger_lvl - 0.5, raw_wl)), 2)

                # Hydrochemical water quality parameters
                # pH: slightly lowers during rain recharge, seasonal fluctuation
                base_ph = 7.30 + (0.10 * math.sin(2.0 * math.pi * d_year / 365.25))
                ph = round(max(6.8, min(7.9, base_ph + ((rng.random() - 0.5) * 0.06) - (rain_mm * 0.002))), 2)

                # TDS: concentrated in summer, diluted by rainwater in monsoon
                tds_base = 370.0 - (65.0 * max(0.0, season_factor)) + (50.0 * max(0.0, -season_factor))
                tds_ppm = round(max(200.0, min(500.0, tds_base + ((rng.random() - 0.5) * 15.0) - (rain_mm * 1.5))), 1)

                # Turbidity: low in dry season, spikes during intense runoff
                turb_base = 2.2 + ((rng.random() - 0.5) * 0.4)
                if rain_mm > 0:
                    turb_base += (rain_mm * 0.22)
                turbidity_ntu = round(max(1.0, min(30.0, turb_base)), 1)

                # Water temperature: follows thermal cycle with ~30-day thermal lag
                temp_wave = math.sin(2.0 * math.pi * (d_year - 110.0) / 365.25)
                temp_c = round(21.5 + (temp_wave * 4.5) + ((rng.random() - 0.5) * 0.3), 1)

                # Dissolved oxygen: inversely related to water temperature
                do_mg_l = round(max(5.5, min(8.5, 9.4 - (temp_c * 0.12) + ((rng.random() - 0.5) * 0.2))), 1)

                # Convert ts to naive UTC for SQLite DateTime compatibility
                naive_ts = ts.replace(tzinfo=None)

                reading_obj = Reading(
                    well_id=well_id,
                    sensor_id=None,
                    water_level_m=water_level_m,
                    ph=ph,
                    tds_ppm=tds_ppm,
                    turbidity_ntu=turbidity_ntu,
                    dissolved_oxygen_mg_l=do_mg_l,
                    temperature_c=temp_c,
                    status=DataStatusEnum.SIMULATED,
                    source=DataSourceEnum.SYNTHETIC,
                    timestamp=naive_ts,
                    received_at=naive_ts,
                )
                readings_to_insert.append(reading_obj)

            # Bulk insert in chunks of 500 for optimal SQLite performance
            chunk_size = 500
            for i in range(0, len(readings_to_insert), chunk_size):
                chunk = readings_to_insert[i : i + chunk_size]
                session.bulk_save_objects(chunk)
                session.flush()

            session.commit()

            # Retrieve overall timestamp bounds
            earliest_ts, latest_ts = (
                session.query(func.min(Reading.timestamp), func.max(Reading.timestamp))
                .filter(Reading.well_id == well_id)
                .first()
            )

            total_well_readings = (
                session.query(Reading).filter(Reading.well_id == well_id).count()
            )

            logger.info(
                f"[HistoricalBackfill] Completed backfill for well {well_id}: "
                f"created {len(readings_to_insert)} readings. Total readings now: {total_well_readings}."
            )

            return {
                "well_id": well_id,
                "status": "COMPLETED",
                "readings_created": len(readings_to_insert),
                "total_readings": total_well_readings,
                "earliest_timestamp": earliest_ts.isoformat() if earliest_ts else None,
                "latest_timestamp": latest_ts.isoformat() if latest_ts else None,
                "data_provenance": "SIMULATED / SYNTHETIC",
            }

        except Exception as e:
            session.rollback()
            logger.error(f"[HistoricalBackfill Error] Failed to backfill well {well_id}: {e}")
            raise e
        finally:
            if should_close:
                session.close()

    @classmethod
    def backfill_all_eligible_wells(
        cls,
        span_days: int = DEFAULT_SPAN_DAYS,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Idempotent backfill of 3-year historical simulated data across all eligible simulated wells.
        """
        session = db or SessionLocal()
        should_close = db is None

        start_perf = datetime.now(timezone.utc)
        results: List[Dict[str, Any]] = []
        total_created = 0
        wells_processed = 0
        wells_skipped = 0

        try:
            eligible_wells = (
                session.query(Well)
                .filter(Well.is_active == True)
                .all()
            )

            for well in eligible_wells:
                if not cls.is_well_eligible_for_backfill(well, session):
                    wells_skipped += 1
                    continue

                res = cls.backfill_well_history(well.id, span_days=span_days, db=session)
                results.append(res)
                total_created += res.get("readings_created", 0)
                wells_processed += 1

            duration_s = (datetime.now(timezone.utc) - start_perf).total_seconds()

            return {
                "status": "SUCCESS",
                "wells_processed": wells_processed,
                "wells_skipped": wells_skipped,
                "total_readings_created": total_created,
                "duration_seconds": round(duration_s, 2),
                "span_days": span_days,
                "details": results[:10],  # summary sample
            }
        finally:
            if should_close:
                session.close()


historical_simulation_service = HistoricalSimulationService()
