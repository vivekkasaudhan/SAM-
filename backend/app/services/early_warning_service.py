import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.database import (
    SessionLocal,
    Well,
    Reading,
    Sensor,
    Alert,
    DataStatusEnum,
)
from app.services.forecasting_service import GroundwaterForecastingService


class EarlyWarningService:
    """
    Groundwater Early-Warning Risk Assessment & Anomaly Detection Service.
    - Evaluates physical & simulated wells across current stage, historical rates, and forecast trajectories.
    - Accurately respects water-column stage convention (detects both high-overflow hazards and depletion/drawdown).
    - Detects rapid decline, critical thresholds, forecasted crossings, stale telemetry, and water-quality violations.
    - Enforces idempotent deduplication of active alerts.
    - Attaches scientific explanations, recommended actions, and predictive disclaimers.
    """

    # Configurable global baseline defaults (overridable per station)
    DEFAULT_CRITICAL_LOW_M = 1.2
    DEFAULT_WARNING_LOW_M = 1.8
    DEFAULT_RAPID_DECLINE_24H_M = 0.25
    DEFAULT_STALE_HOURS = 2.0
    DEFAULT_OFFLINE_HOURS = 24.0

    @classmethod
    def evaluate_well(
        cls,
        well_id: str,
        evaluate_forecast: bool = True,
        db: Optional[Session] = None,
    ) -> List[Alert]:
        """
        Comprehensive early-warning evaluation for a single monitoring well.
        Returns list of currently active alerts for this well.
        """
        session = db or SessionLocal()
        should_close = db is None

        try:
            well = session.query(Well).filter(Well.id == well_id).first()
            if not well:
                raise ValueError(f"Well station '{well_id}' not found.")

            now = datetime.now(timezone.utc)
            active_alerts: List[Alert] = []

            # 1. Fetch latest readings for this station
            recent_readings = (
                session.query(Reading)
                .filter(Reading.well_id == well_id)
                .order_by(Reading.timestamp.desc())
                .limit(50)
                .all()
            )
            latest = recent_readings[0] if recent_readings else None

            # Well-specific configurable thresholds
            high_danger = well.danger_level_m if well.danger_level_m is not None else 8.5
            high_warning = well.warning_level_m if well.warning_level_m is not None else 7.5
            critical_low = cls.DEFAULT_CRITICAL_LOW_M
            warning_low = cls.DEFAULT_WARNING_LOW_M
            rapid_decline_threshold = cls.DEFAULT_RAPID_DECLINE_24H_M

            detected_conditions: Dict[str, Dict[str, Any]] = {}

            # ─── CHECK 1: Telemetry Freshness & Availability ─────────────
            if not latest:
                detected_conditions["STALE_TELEMETRY"] = {
                    "severity": "CRITICAL",
                    "metric": "freshness",
                    "observed_value": None,
                    "threshold_value": cls.DEFAULT_STALE_HOURS,
                    "unit": "hours",
                    "reason": "Station has zero recorded telemetry readings in database. Telemetry stream is completely unavailable.",
                    "recommended_action": "Check station deployment status, verify hardware provisioning, and inspect IoT network connection.",
                    "is_forecast": False,
                }
            else:
                last_ts = latest.timestamp
                if last_ts.tzinfo is None:
                    last_ts = last_ts.replace(tzinfo=timezone.utc)
                age_hours = (now - last_ts).total_seconds() / 3600.0

                if age_hours >= cls.DEFAULT_OFFLINE_HOURS:
                    detected_conditions["STALE_TELEMETRY"] = {
                        "severity": "CRITICAL",
                        "metric": "freshness",
                        "observed_value": round(age_hours, 1),
                        "threshold_value": cls.DEFAULT_OFFLINE_HOURS,
                        "unit": "hours",
                        "reason": f"Sensor telemetry is OFFLINE. Last transmission was received {age_hours:.1f} hours ago (offline threshold: {cls.DEFAULT_OFFLINE_HOURS}h).",
                        "recommended_action": "Dispatch maintenance technician to inspect station power supply, solar cell, battery voltage, and cellular probe.",
                        "is_forecast": False,
                    }
                elif age_hours >= cls.DEFAULT_STALE_HOURS:
                    detected_conditions["STALE_TELEMETRY"] = {
                        "severity": "WARNING",
                        "metric": "freshness",
                        "observed_value": round(age_hours, 1),
                        "threshold_value": cls.DEFAULT_STALE_HOURS,
                        "unit": "hours",
                        "reason": f"Telemetry is STALE. Last reading logged {age_hours:.1f} hours ago (freshness limit: {cls.DEFAULT_STALE_HOURS}h). Data is not updating in real time.",
                        "recommended_action": "Monitor next transmission interval, verify probe signal strength, and inspect gateway telemetry queue.",
                        "is_forecast": False,
                    }

            if latest:
                wl = latest.water_level_m

                # ─── CHECK 2: Critical High Stage (Flood / Waterlogging Risk) ───
                if wl >= high_danger:
                    detected_conditions["CRITICAL_HIGH"] = {
                        "severity": "CRITICAL",
                        "metric": "water_level",
                        "observed_value": round(wl, 2),
                        "threshold_value": round(high_danger, 2),
                        "unit": "m",
                        "reason": f"Water stage of {wl:.2f}m has exceeded the critical danger threshold of {high_danger:.2f}m (surplus +{wl - high_danger:.2f}m). High risk of surface waterlogging or wellhead flooding.",
                        "recommended_action": "Alert local water authority, inspect wellhead flood seal, deploy surface runoff diversions, and check pump station status.",
                        "is_forecast": False,
                    }
                elif wl >= high_warning:
                    detected_conditions["CRITICAL_HIGH"] = {
                        "severity": "WARNING",
                        "metric": "water_level",
                        "observed_value": round(wl, 2),
                        "threshold_value": round(high_warning, 2),
                        "unit": "m",
                        "reason": f"Water stage of {wl:.2f}m has reached the warning threshold of {high_warning:.2f}m (approaching danger level {high_danger:.2f}m).",
                        "recommended_action": "Increase monitoring cadence, check localized drainage culverts, and prepare precautionary retention measures.",
                        "is_forecast": False,
                    }

                # ─── CHECK 3: Critical Low Stage (Depletion / Dry Well Risk) ───
                if wl <= critical_low:
                    detected_conditions["CRITICAL_LOW"] = {
                        "severity": "CRITICAL",
                        "metric": "water_level",
                        "observed_value": round(wl, 2),
                        "threshold_value": round(critical_low, 2),
                        "unit": "m",
                        "reason": f"Water stage has dropped to {wl:.2f}m, breaching critical depletion threshold of {critical_low:.2f}m. Submersible pump cavitation or dry wellhead imminent.",
                        "recommended_action": "Enact emergency groundwater abstraction curtailment, pause heavy agricultural/industrial extraction, and inspect regional water table.",
                        "is_forecast": False,
                    }
                elif wl <= warning_low:
                    detected_conditions["CRITICAL_LOW"] = {
                        "severity": "WARNING",
                        "metric": "water_level",
                        "observed_value": round(wl, 2),
                        "threshold_value": round(warning_low, 2),
                        "unit": "m",
                        "reason": f"Water stage of {wl:.2f}m is approaching depletion warning limit ({warning_low:.2f}m). Ground storage reserves are significantly depressed.",
                        "recommended_action": "Recommend water conservation advisory, monitor pump runtime, and evaluate recharge aquifer recovery.",
                        "is_forecast": False,
                    }

                # ─── CHECK 4: Rapid Water-Level Decline ────────────────────────
                # Find observation ~24 hours ago (window between 18h and 30h)
                past_24h_reading = None
                for r in recent_readings:
                    r_ts = r.timestamp.replace(tzinfo=timezone.utc) if r.timestamp.tzinfo is None else r.timestamp
                    delta_h = (last_ts - r_ts).total_seconds() / 3600.0
                    if 18.0 <= delta_h <= 30.0:
                        past_24h_reading = r
                        break

                if past_24h_reading:
                    delta_wl = past_24h_reading.water_level_m - wl  # positive if dropped
                    if delta_wl >= rapid_decline_threshold:
                        detected_conditions["RAPID_DECLINE"] = {
                            "severity": "CRITICAL" if delta_wl >= rapid_decline_threshold * 2.0 else "WARNING",
                            "metric": "water_level",
                            "observed_value": round(delta_wl, 3),
                            "threshold_value": round(rapid_decline_threshold, 3),
                            "unit": "m/24h",
                            "reason": f"Rapid water-level drop of {delta_wl:.2f}m observed over the past 24 hours (threshold: {rapid_decline_threshold:.2f}m/24h). Indicates heavy localized extraction, sudden borehole breach, or intense drawdown.",
                            "recommended_action": "Conduct immediate wellhead audit for unmetered extraction, check for nearby newly active deep borewells, and assess recharge integrity.",
                            "is_forecast": False,
                        }

                # ─── CHECK 5: Water Quality Anomalies ──────────────────────────
                wq_issues = []
                if latest.ph < 6.0 or latest.ph > 9.0:
                    wq_issues.append(f"pH {latest.ph:.2f} outside safe limits [6.5 - 8.5]")
                if latest.turbidity_ntu > 20.0:
                    wq_issues.append(f"Turbidity {latest.turbidity_ntu:.1f} NTU exceeds standard 10 NTU limit")
                if latest.tds_ppm > 800.0:
                    wq_issues.append(f"TDS {latest.tds_ppm:.1f} ppm exceeds potable threshold (500 ppm)")
                if latest.dissolved_oxygen_mg_l < 4.0:
                    wq_issues.append(f"Dissolved oxygen {latest.dissolved_oxygen_mg_l:.1f} mg/L indicates anaerobic stagnation")

                if wq_issues:
                    is_severe = (latest.ph < 5.5 or latest.ph > 9.5 or latest.turbidity_ntu > 50.0 or latest.tds_ppm > 1200.0)
                    detected_conditions["WATER_QUALITY_ANOMALY"] = {
                        "severity": "CRITICAL" if is_severe else "WARNING",
                        "metric": "water_quality",
                        "observed_value": round(latest.ph, 2),
                        "threshold_value": 8.5,
                        "unit": "pH/NTU/ppm",
                        "reason": f"Water quality degradation detected: {'; '.join(wq_issues)}.",
                        "recommended_action": "Collect core water sample for laboratory chemical/biological assay; check for surface runoff contamination or sewage intrusion.",
                        "is_forecast": False,
                    }

            # ─── CHECK 6: Forecasted Threshold Crossing ─────────────────────
            if evaluate_forecast and latest and len(recent_readings) >= 5:
                try:
                    f_service = GroundwaterForecastingService(db=session)
                    f_res = f_service.generate_forecast(well_id, horizon_days=7, include_backtest=False, persist=False, db=session)
                    if f_res.get("status") == "SUCCESS":
                        predictions = f_res.get("predictions", [])
                        crossing_day = None
                        crossing_type = None
                        crossing_est = None

                        for p in predictions:
                            est = p["estimated_water_level_m"]
                            if est >= high_danger:
                                crossing_day = p["day_offset"]
                                crossing_type = "HIGH_DANGER"
                                crossing_est = est
                                break
                            elif est <= critical_low:
                                crossing_day = p["day_offset"]
                                crossing_type = "CRITICAL_DEPLETION"
                                crossing_est = est
                                break

                        if crossing_day is not None:
                            horizon_label = f"{crossing_day} days" if crossing_day > 1 else "24 hours"
                            if crossing_type == "HIGH_DANGER":
                                reason_text = (
                                    f"Groundwater trajectory model projects water level to reach {crossing_est:.2f}m (exceeding {high_danger:.2f}m danger line) within approximately {horizon_label}. "
                                    f"PREDICTIVE NOTICE: Projections are model-based early indicators intended for proactive monitoring; atmospheric and hydrogeological uncertainties mean future crossing is not a guaranteed crisis."
                                )
                                action_text = "Review 7-day precipitation forecast, prepare stormwater retention gates, and alert regional flood monitoring unit."
                            else:
                                reason_text = (
                                    f"Groundwater trajectory model projects water level to drop to {crossing_est:.2f}m (breaching {critical_low:.2f}m critical low) within approximately {horizon_label}. "
                                    f"PREDICTIVE NOTICE: Projections are model-based early indicators intended for proactive monitoring; future water crisis is NOT certain."
                                )
                                action_text = "Schedule proactive extraction throttling, inform municipal water managers, and review aquifer recharge forecasts."

                            detected_conditions["FORECASTED_CROSSING"] = {
                                "severity": "WARNING",
                                "metric": "water_level_forecast",
                                "observed_value": round(crossing_est, 2),
                                "threshold_value": round(high_danger if crossing_type == "HIGH_DANGER" else critical_low, 2),
                                "unit": "m",
                                "reason": reason_text,
                                "recommended_action": action_text,
                                "is_forecast": True,
                                "forecast_horizon_days": crossing_day,
                            }
                except Exception as e:
                    # Never let forecast evaluation errors crash real telemetry checks
                    print(f"[EarlyWarning Warning] Forecast check skipped for {well_id}: {e}")

            # ─── DEDUPLICATION & PERSISTENCE OF ALERTS ───────────────────────
            # Query currently ACTIVE alerts for this well
            existing_active_alerts = (
                session.query(Alert)
                .filter(Alert.well_id == well_id, Alert.status == "ACTIVE")
                .all()
            )
            existing_by_type = {a.alert_type: a for a in existing_active_alerts}

            # 1. Update existing active alerts or create new ones
            for alert_type, data in detected_conditions.items():
                if alert_type in existing_by_type:
                    # Update existing active alert in-place (DEDUPLICATION GUARANTEE)
                    existing = existing_by_type[alert_type]
                    existing.last_evaluated_at = now
                    existing.observed_value = data.get("observed_value")
                    existing.threshold_value = data.get("threshold_value")
                    existing.severity = data.get("severity")
                    existing.reason = data.get("reason")
                    existing.recommended_action = data.get("recommended_action")
                    if data.get("forecast_horizon_days") is not None:
                        existing.forecast_horizon_days = data["forecast_horizon_days"]
                    active_alerts.append(existing)
                else:
                    # Create new alert row
                    new_alert = Alert(
                        well_id=well_id,
                        alert_type=alert_type,
                        severity=data["severity"],
                        is_forecast=data.get("is_forecast", False),
                        forecast_horizon_days=data.get("forecast_horizon_days"),
                        metric=data["metric"],
                        observed_value=data.get("observed_value"),
                        threshold_value=data.get("threshold_value"),
                        unit=data.get("unit", "m"),
                        reason=data["reason"],
                        recommended_action=data["recommended_action"],
                        status="ACTIVE",
                        created_at=now,
                        last_evaluated_at=now,
                    )
                    session.add(new_alert)
                    active_alerts.append(new_alert)

            # 2. Resolve alerts that are no longer detected
            for alert_type, existing in existing_by_type.items():
                if alert_type not in detected_conditions:
                    existing.status = "RESOLVED"
                    existing.resolved_at = now
                    existing.last_evaluated_at = now

            session.commit()
            for a in active_alerts:
                session.refresh(a)

            return active_alerts
        finally:
            if should_close:
                session.close()

    @classmethod
    def evaluate_all_wells(cls, db: Optional[Session] = None) -> Dict[str, Any]:
        """Evaluate early warning conditions across all registered active wells."""
        session = db or SessionLocal()
        should_close = db is None

        try:
            wells = session.query(Well).filter(Well.is_active == True).all()
            total_active_alerts = 0
            wells_with_alerts = 0
            results = []

            for w in wells:
                alerts = cls.evaluate_well(w.id, evaluate_forecast=True, db=session)
                if alerts:
                    wells_with_alerts += 1
                    total_active_alerts += len(alerts)
                results.append({
                    "well_id": w.id,
                    "well_name": w.name,
                    "active_alert_count": len(alerts),
                    "severities": [a.severity for a in alerts],
                })

            return {
                "evaluated_at": datetime.now(timezone.utc).isoformat(),
                "total_wells_evaluated": len(wells),
                "wells_with_active_alerts": wells_with_alerts,
                "total_active_alerts": total_active_alerts,
                "details": results,
            }
        finally:
            if should_close:
                session.close()
