from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import SessionLocal, Alert, Well, User
from app.auth import get_current_user, get_db
from app.services.early_warning_service import EarlyWarningService

router = APIRouter(prefix="/alerts", tags=["Early-Warning & Risk Alerts"])


class AlertOut(BaseModel):
    id: int
    well_id: str
    well_name: Optional[str] = None
    alert_type: str
    severity: str
    is_forecast: bool
    forecast_horizon_days: Optional[int] = None
    metric: str
    observed_value: Optional[float] = None
    threshold_value: Optional[float] = None
    unit: str
    reason: str
    recommended_action: str
    status: str
    created_at: datetime
    last_evaluated_at: datetime
    resolved_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class AlertSummaryOut(BaseModel):
    total_active: int
    critical_count: int
    warning_count: int
    info_count: int
    forecast_alert_count: int
    observed_alert_count: int
    wells_affected: int
    evaluated_at: str


@router.get("", response_model=List[AlertOut])
def list_alerts(
    well_id: Optional[str] = Query(None, description="Filter alerts by station ID"),
    status: str = Query("ACTIVE", description="ACTIVE | RESOLVED | ACKNOWLEDGED | ALL"),
    severity: Optional[str] = Query(None, description="CRITICAL | WARNING | INFO"),
    is_forecast: Optional[bool] = Query(None, description="Filter by predictive vs observed alert"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    List early-warning risk alerts with filtering by well, status, severity, and forecast flag.
    Clearly distinguishes observed telemetry issues from model-projected risks.
    """
    query = db.query(Alert)

    if well_id:
        query = query.filter(Alert.well_id == well_id)

    if status.upper() != "ALL":
        query = query.filter(Alert.status == status.upper())

    if severity:
        query = query.filter(Alert.severity == severity.upper())

    if is_forecast is not None:
        query = query.filter(Alert.is_forecast == is_forecast)

    alerts = query.order_by(desc(Alert.created_at)).limit(limit).all()

    # Pre-populate well_name for UI display
    well_ids = list({a.well_id for a in alerts})
    wells_map = {w.id: w.name for w in db.query(Well).filter(Well.id.in_(well_ids)).all()} if well_ids else {}

    results = []
    for a in alerts:
        item = AlertOut.model_validate(a)
        item.well_name = wells_map.get(a.well_id)
        results.append(item)

    return results


@router.get("/summary", response_model=AlertSummaryOut)
def get_alerts_summary(db: Session = Depends(get_db)):
    """Aggregate summary statistics for system-wide early-warning alerts."""
    active_alerts = db.query(Alert).filter(Alert.status == "ACTIVE").all()

    critical_count = sum(1 for a in active_alerts if a.severity == "CRITICAL")
    warning_count = sum(1 for a in active_alerts if a.severity == "WARNING")
    info_count = sum(1 for a in active_alerts if a.severity == "INFO")
    forecast_count = sum(1 for a in active_alerts if a.is_forecast)
    observed_count = sum(1 for a in active_alerts if not a.is_forecast)
    wells_affected = len(set(a.well_id for a in active_alerts))

    return AlertSummaryOut(
        total_active=len(active_alerts),
        critical_count=critical_count,
        warning_count=warning_count,
        info_count=info_count,
        forecast_alert_count=forecast_count,
        observed_alert_count=observed_count,
        wells_affected=wells_affected,
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/evaluate")
def trigger_alert_evaluation(
    well_id: Optional[str] = Query(None, description="Specific well ID or omit for all wells"),
    db: Session = Depends(get_db),
):
    """
    Trigger real-time early warning risk evaluation.
    Evaluates observed stage, rate of decline, water quality, and forecast trajectories.
    Prevents duplicate active alerts and updates active statuses idempotently.
    """
    if well_id:
        w = db.query(Well).filter(Well.id == well_id).first()
        if not w:
            raise HTTPException(status_code=404, detail=f"Well station '{well_id}' was not found.")
        active = EarlyWarningService.evaluate_well(well_id, evaluate_forecast=True, db=db)
        return {
            "status": "COMPLETED",
            "well_id": well_id,
            "active_alert_count": len(active),
            "alerts": [AlertOut.model_validate(a) for a in active],
        }

    summary = EarlyWarningService.evaluate_all_wells(db=db)
    return summary


@router.post("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Acknowledge an early-warning alert (Subadmins or Main Admin)."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert #{alert_id} not found.")

    alert.status = "ACKNOWLEDGED"
    alert.last_evaluated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return AlertOut.model_validate(alert)
