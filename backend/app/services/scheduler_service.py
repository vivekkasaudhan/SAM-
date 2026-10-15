import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.models.database import SessionLocal, Well, Sensor, Reading, DataStatusEnum, DataSourceEnum
from app.simulation.engine import SyntheticEngine

logger = logging.getLogger("aquasense.scheduler")


class SimulationScheduler:
    """
    Reliable background scheduler for AquaSense simulated environmental readings.
    - Integrated with FastAPI lifespan.
    - Runs every 5 minutes (configurable via settings.simulation_interval_seconds).
    - Persists deterministic SyntheticEngine readings for all eligible simulated wells.
    - Strictly blocks simulation on physical sensor wells and manual monitoring wells.
    - Idempotent and thread-safe: guarantees single startup per process and deduplication.
    - Resilient: handles database errors without killing the background loop.
    """

    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._is_running: bool = False
        self._lock = asyncio.Lock()
        self._last_run_timestamp: Optional[datetime] = None
        self._total_cycles_run: int = 0
        self._total_readings_generated: int = 0
        self._last_cycle_summary: Dict[str, Any] = {}

    @property
    def is_running(self) -> bool:
        return self._is_running

    @property
    def status(self) -> Dict[str, Any]:
        return {
            "is_running": self._is_running,
            "interval_seconds": settings.simulation_interval_seconds,
            "total_cycles_run": self._total_cycles_run,
            "total_readings_generated": self._total_readings_generated,
            "last_run_timestamp": self._last_run_timestamp.isoformat() if self._last_run_timestamp else None,
            "last_cycle_summary": self._last_cycle_summary,
        }

    async def start(self):
        """Start the background scheduler task if not already running."""
        async with self._lock:
            if self._is_running or (self._task and not self._task.done()):
                logger.info("[Scheduler] SimulationScheduler is already running in this process.")
                return

            self._is_running = True
            self._task = asyncio.create_task(self._run_loop(), name="AquaSense-SimulationScheduler")
            logger.info(
                f"[Scheduler] SimulationScheduler started successfully. Interval: {settings.simulation_interval_seconds}s."
            )

    async def stop(self):
        """Cleanly cancel and await shutdown of the background scheduler task."""
        async with self._lock:
            if not self._is_running and not self._task:
                return

            self._is_running = False
            if self._task and not self._task.done():
                logger.info("[Scheduler] Shutting down SimulationScheduler background task...")
                self._task.cancel()
                try:
                    await asyncio.wait_for(asyncio.shield(self._task), timeout=5.0)
                except (asyncio.CancelledError, asyncio.TimeoutError):
                    pass
                except Exception as e:
                    logger.warning(f"[Scheduler] Exception during scheduler cancellation: {e}")

            self._task = None
            logger.info("[Scheduler] SimulationScheduler stopped cleanly.")

    async def _run_loop(self):
        """Main periodic loop."""
        interval = max(5, settings.simulation_interval_seconds)
        logger.info(f"[Scheduler] Background loop active. Next cycle in {interval} seconds.")

        while self._is_running:
            try:
                # Sleep first or wait for interval (respecting cancellation)
                await asyncio.sleep(interval)

                if not self._is_running:
                    break

                # Execute simulation cycle
                summary = await asyncio.to_thread(self.generate_simulated_readings_cycle)
                self._last_run_timestamp = datetime.now(timezone.utc)
                self._total_cycles_run += 1
                self._total_readings_generated += summary.get("readings_created", 0)
                self._last_cycle_summary = summary

                logger.info(
                    f"[Scheduler Cycle #{self._total_cycles_run}] "
                    f"Readings created: {summary.get('readings_created', 0)}, "
                    f"Skipped (dedup/ineligible): {summary.get('skipped_wells', 0)}"
                )

            except asyncio.CancelledError:
                logger.info("[Scheduler] Loop cancelled.")
                break
            except Exception as e:
                logger.error(f"[Scheduler Error] Error in simulation cycle: {e}", exc_info=True)
                # Sleep briefly before retry to avoid spinning on persistent errors
                await asyncio.sleep(10)

    @classmethod
    def is_well_eligible_for_simulation(cls, well: Well, db: Session) -> bool:
        """
        Determine if a well is strictly eligible for synthetic telemetry generation.
        Policy:
        - Must be active (is_active == True)
        - Must NOT be marked as MANUAL monitoring
        - Must NOT be marked as PHYSICAL_SENSOR monitoring
        - Must NOT have any provisioned physical hardware sensor (api_key_hash is set)
        - Must NOT have any historical LIVE physical sensor readings
        """
        if not well.is_active:
            return False

        mon_type = (getattr(well, "monitoring_type", None) or "SIMULATED").upper()
        if mon_type in ("MANUAL", "PHYSICAL_SENSOR", "OFFLINE"):
            return False

        # Inspect sensors attached to well
        for sensor in well.sensors:
            if getattr(sensor, "api_key_hash", None) is not None:
                # Hardware API key provisioned -> Physical IoT sensor, never simulate!
                return False

        # Inspect latest reading status
        latest_live = (
            db.query(Reading)
            .filter(Reading.well_id == well.id, Reading.status == DataStatusEnum.LIVE)
            .first()
        )
        if latest_live:
            # Has verified live physical telemetry -> do not overwrite with synthetic
            return False

        return True

    def generate_simulated_readings_cycle(
        self, db: Optional[Session] = None, force_wells: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Synchronous transaction executing one full reading generation cycle across all eligible wells.
        Can be called directly from unit tests or API triggers.
        """
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            now = datetime.now(timezone.utc)
            query = db.query(Well).filter(Well.is_active == True)
            if force_wells:
                query = query.filter(Well.id.in_(force_wells))

            all_wells = query.all()
            eligible_wells = [w for w in all_wells if self.is_well_eligible_for_simulation(w, db)]

            readings_created = 0
            skipped_dedup = 0
            skipped_ineligible = len(all_wells) - len(eligible_wells)
            created_details = []

            # Deduplication window: within (interval - 30) seconds
            dedup_threshold = max(30, settings.simulation_interval_seconds - 30)

            for well in eligible_wells:
                # Check for recent reading to avoid duplicates from retries / fast calls
                latest = (
                    db.query(Reading)
                    .filter(Reading.well_id == well.id)
                    .order_by(Reading.timestamp.desc())
                    .first()
                )

                if latest and latest.timestamp:
                    l_ts = latest.timestamp
                    if l_ts.tzinfo is None:
                        l_ts = l_ts.replace(tzinfo=timezone.utc)
                    age_seconds = (now - l_ts).total_seconds()
                    if age_seconds < dedup_threshold:
                        skipped_dedup += 1
                        continue

                # Generate simulated reading via SyntheticEngine
                engine = SyntheticEngine(well.latitude, well.longitude)
                water_level = engine.get_water_level(now)
                wq = engine.get_water_quality(now)

                # Associate sensor if available
                sensor_id = well.sensors[0].id if well.sensors else None

                new_reading = Reading(
                    well_id=well.id,
                    sensor_id=sensor_id,
                    water_level_m=water_level,
                    ph=wq["ph"],
                    tds_ppm=wq["tds"],
                    turbidity_ntu=wq["turbidity"],
                    dissolved_oxygen_mg_l=wq["dissolved_oxygen"],
                    temperature_c=wq["temperature"],
                    status=DataStatusEnum.SIMULATED,
                    source=DataSourceEnum.SYNTHETIC,
                    timestamp=now,
                )
                db.add(new_reading)
                readings_created += 1
                created_details.append({"well_id": well.id, "water_level_m": water_level})

            db.commit()

            return {
                "timestamp": now.isoformat(),
                "total_wells_inspected": len(all_wells),
                "eligible_wells": len(eligible_wells),
                "readings_created": readings_created,
                "skipped_dedup": skipped_dedup,
                "skipped_ineligible": skipped_ineligible,
                "wells_updated": created_details,
            }

        except Exception as e:
            db.rollback()
            logger.error(f"[Scheduler DB Error] Failed generating simulation cycle: {e}")
            raise
        finally:
            if should_close:
                db.close()


# Singleton scheduler instance for the application process
simulation_scheduler = SimulationScheduler()
