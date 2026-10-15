from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
from app.services.scheduler_service import simulation_scheduler
from app.auth import get_current_admin, User
from app.models.database import SessionLocal

router = APIRouter(prefix="/scheduler", tags=["Background Simulation Scheduler"])


@router.get("/status", response_model=Dict[str, Any])
def get_scheduler_status():
    """Return status of the background simulation engine scheduler."""
    return simulation_scheduler.status


@router.post("/trigger", response_model=Dict[str, Any])
def trigger_simulation_cycle(admin: User = Depends(get_current_admin)):
    """
    Manually trigger one reading generation cycle immediately across all eligible wells.
    Requires Main Admin or Subadmin authorization.
    """
    try:
        db = SessionLocal()
        try:
            summary = simulation_scheduler.generate_simulated_readings_cycle(db)
            return {
                "message": "Simulation cycle executed successfully.",
                "summary": summary,
            }
        finally:
            db.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation trigger failed: {e}")


@router.post("/backfill", response_model=Dict[str, Any])
def backfill_historical_simulation(
    well_id: Optional[str] = None,
    years: int = 3,
    admin: User = Depends(get_current_admin),
):
    """
    Explicit, idempotent backfill of multi-year simulated historical data for demo and forecasting.
    - Generates 1, 2, or 3 years of plausible seasonal and multi-year data.
    - Strictly restricted to eligible simulated wells (never for physical sensor or manual wells).
    - Checks timestamps before inserting: never duplicates or overwrites existing records.
    - Requires Admin or Subadmin authorization.
    """
    from app.services.historical_simulation_service import HistoricalSimulationService
    try:
        db = SessionLocal()
        try:
            span_days = max(30, min(1825, years * 365))
            if well_id:
                summary = HistoricalSimulationService.backfill_well_history(well_id, span_days=span_days, db=db)
            else:
                summary = HistoricalSimulationService.backfill_all_eligible_wells(span_days=span_days, db=db)
            return {
                "message": "Historical simulation backfill completed successfully.",
                "summary": summary,
            }
        finally:
            db.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Historical backfill failed: {e}")

