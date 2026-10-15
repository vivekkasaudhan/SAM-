from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
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
