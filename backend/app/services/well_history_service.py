import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.models.database import SessionLocal, Well, Reading, DataStatusEnum, DataSourceEnum


class WellHistoryService:
    """
    High-performance historical time-series retrieval & aggregation service for monitoring wells.
    - Strictly queries actual persisted database records (Zero Fabrication).
    - Supports Live/Recent, 1-Year, 2-Year, 3-Year, and Custom Date Ranges.
    - Aggregates by day or hour using SQLite strftime with MIN/MAX/AVG envelopes.
    - Automatically identifies and reports historical missing periods / data gaps.
    - Clearly labels simulated vs physical sensor readings.
    """

    @classmethod
    def resolve_date_bounds(
        cls,
        range_type: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> tuple[datetime, datetime, str]:
        """Resolve start_date, end_date, and aggregation mode based on requested range."""
        now = datetime.now(timezone.utc)
        r = (range_type or "recent").lower().strip()

        if r in ("live", "recent", "24h", "48h"):
            start = now - timedelta(hours=48)
            end = now
            agg = "raw"
        elif r in ("7d", "week"):
            start = now - timedelta(days=7)
            end = now
            agg = "hour"
        elif r in ("1y", "1year", "last_1_year"):
            start = now - timedelta(days=365)
            end = now
            agg = "day"
        elif r in ("2y", "2years", "last_2_years"):
            start = now - timedelta(days=730)
            end = now
            agg = "day"
        elif r in ("3y", "3years", "last_3_years"):
            start = now - timedelta(days=1095)
            end = now
            agg = "day"
        elif r == "custom":
            end = end_date or now
            start = start_date or (end - timedelta(days=30))
            if start > end:
                start, end = end, start
            span_days = (end - start).total_seconds() / 86400.0
            if span_days <= 2:
                agg = "raw"
            elif span_days <= 14:
                agg = "hour"
            else:
                agg = "day"
        else:
            # Default to recent
            start = now - timedelta(hours=48)
            end = now
            agg = "raw"

        return start, end, agg

    @classmethod
    def get_historical_analysis(
        cls,
        well_id: str,
        range_type: str = "recent",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        aggregate: Optional[str] = "auto",
        limit: int = 1000,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            well = db.query(Well).filter(Well.id == well_id).first()
            if not well:
                return {
                    "error": f"Well '{well_id}' not found",
                    "readings": [],
                    "total_records": 0,
                    "has_missing_data": True,
                }

            resolved_start, resolved_end, auto_agg = cls.resolve_date_bounds(
                range_type, start_date, end_date
            )

            # Ensure limit covers full 3-year range for daily aggregations (1095+ days)
            effective_limit = max(limit, 3500) if (range_type in ("3y", "3years", "last_3_years") or (resolved_end - resolved_start).days >= 700) else limit

            # Determine final aggregation mode
            agg_mode = auto_agg if (not aggregate or aggregate == "auto") else aggregate.lower()

            # If eligible simulated well has fewer than 12 readings, safely backfill multi-year history
            existing_count = db.query(Reading).filter(Reading.well_id == well_id).count()
            if existing_count < 12 and (getattr(well, "monitoring_type", None) or "SIMULATED").upper() == "SIMULATED":
                from app.services.historical_simulation_service import HistoricalSimulationService
                if HistoricalSimulationService.is_well_eligible_for_backfill(well, db):
                    HistoricalSimulationService.backfill_well_history(well_id, span_days=1095, db=db)

            # Inspect well overall recording bounds
            first_last = (
                db.query(func.min(Reading.timestamp), func.max(Reading.timestamp))
                .filter(Reading.well_id == well_id)
                .first()
            )
            earliest_db_ts = first_last[0] if first_last else None
            latest_db_ts = first_last[1] if first_last else None

            # Detect historical gaps
            missing_periods: List[Dict[str, Any]] = []
            has_missing_data = False

            if not earliest_db_ts:
                has_missing_data = True
                missing_periods.append({
                    "from": resolved_start.isoformat(),
                    "to": resolved_end.isoformat(),
                    "type": "NO_DATA",
                    "reason": f"No telemetry observations recorded for well '{well_id}'.",
                })
            else:
                # Normalize tz
                earliest_tz = earliest_db_ts.replace(tzinfo=timezone.utc) if earliest_db_ts.tzinfo is None else earliest_db_ts
                latest_tz = latest_db_ts.replace(tzinfo=timezone.utc) if latest_db_ts.tzinfo is None else latest_db_ts

                # 1. Check if requested start date predates station recording onset
                if resolved_start < earliest_tz:
                    has_missing_data = True
                    gap_days = round((earliest_tz - resolved_start).total_seconds() / 86400.0, 1)
                    missing_periods.append({
                        "from": resolved_start.isoformat(),
                        "to": earliest_tz.isoformat(),
                        "type": "PRIOR_TO_COMMISSIONING",
                        "duration_days": gap_days,
                        "reason": f"Telemetry history prior to {earliest_tz.strftime('%b %d, %Y')} is unrecorded ({gap_days} days). AquaSense zero-fabrication policy preserves true observation history.",
                    })

                # 2. Check if requested end date extends past latest recorded reading
                if resolved_end > latest_tz and (resolved_end - latest_tz).total_seconds() > 3600:
                    gap_hours = round((resolved_end - latest_tz).total_seconds() / 3600.0, 1)
                    missing_periods.append({
                        "from": latest_tz.isoformat(),
                        "to": resolved_end.isoformat(),
                        "type": "RECENT_GAP",
                        "duration_hours": gap_hours,
                        "reason": f"No readings recorded in the trailing {gap_hours} hours.",
                    })

            # Query readings
            readings_out: List[Dict[str, Any]] = []
            source_breakdown = {"SIMULATED": 0, "LIVE": 0, "ESTIMATED": 0}

            if agg_mode in ("day", "daily"):
                # Daily SQL aggregation using strftime
                raw_sql = """
                    SELECT 
                        strftime('%Y-%m-%d 12:00:00', timestamp) AS bucket,
                        AVG(water_level_m) AS avg_level,
                        MIN(water_level_m) AS min_level,
                        MAX(water_level_m) AS max_level,
                        AVG(ph) AS avg_ph,
                        AVG(tds_ppm) AS avg_tds,
                        AVG(turbidity_ntu) AS avg_turb,
                        AVG(dissolved_oxygen_mg_l) AS avg_do,
                        AVG(temperature_c) AS avg_temp,
                        status,
                        source,
                        COUNT(*) AS sample_count
                    FROM readings
                    WHERE well_id = :well_id 
                      AND timestamp >= :start_ts 
                      AND timestamp <= :end_ts
                    GROUP BY strftime('%Y-%m-%d', timestamp)
                    ORDER BY bucket ASC
                    LIMIT :limit
                """
                results = db.execute(
                    text(raw_sql),
                    {
                        "well_id": well_id,
                        "start_ts": resolved_start,
                        "end_ts": resolved_end,
                        "limit": effective_limit,
                    },
                ).fetchall()

                for row in results:
                    status_str = row[9] if isinstance(row[9], str) else getattr(row[9], "value", "SIMULATED")
                    source_str = row[10] if isinstance(row[10], str) else getattr(row[10], "value", "SYNTHETIC")
                    source_breakdown[status_str] = source_breakdown.get(status_str, 0) + row[11]

                    readings_out.append({
                        "id": None,
                        "well_id": well_id,
                        "sensor_id": None,
                        "water_level_m": round(row[1], 2),
                        "min_water_level_m": round(row[2], 2),
                        "max_water_level_m": round(row[3], 2),
                        "ph": round(row[4], 2),
                        "tds_ppm": round(row[5], 1),
                        "turbidity_ntu": round(row[6], 1),
                        "dissolved_oxygen_mg_l": round(row[7], 1),
                        "temperature_c": round(row[8], 1),
                        "status": status_str,
                        "source": source_str,
                        "timestamp": row[0],
                        "reading_count": row[11],
                    })

            elif agg_mode in ("hour", "hourly"):
                # Hourly SQL aggregation
                raw_sql = """
                    SELECT 
                        strftime('%Y-%m-%d %H:00:00', timestamp) AS bucket,
                        AVG(water_level_m) AS avg_level,
                        MIN(water_level_m) AS min_level,
                        MAX(water_level_m) AS max_level,
                        AVG(ph) AS avg_ph,
                        AVG(tds_ppm) AS avg_tds,
                        AVG(turbidity_ntu) AS avg_turb,
                        AVG(dissolved_oxygen_mg_l) AS avg_do,
                        AVG(temperature_c) AS avg_temp,
                        status,
                        source,
                        COUNT(*) AS sample_count
                    FROM readings
                    WHERE well_id = :well_id 
                      AND timestamp >= :start_ts 
                      AND timestamp <= :end_ts
                    GROUP BY strftime('%Y-%m-%d %H:00:00', timestamp)
                    ORDER BY bucket ASC
                    LIMIT :limit
                """
                results = db.execute(
                    text(raw_sql),
                    {
                        "well_id": well_id,
                        "start_ts": resolved_start,
                        "end_ts": resolved_end,
                        "limit": effective_limit,
                    },
                ).fetchall()

                for row in results:
                    status_str = row[9] if isinstance(row[9], str) else getattr(row[9], "value", "SIMULATED")
                    source_str = row[10] if isinstance(row[10], str) else getattr(row[10], "value", "SYNTHETIC")
                    source_breakdown[status_str] = source_breakdown.get(status_str, 0) + row[11]

                    readings_out.append({
                        "id": None,
                        "well_id": well_id,
                        "sensor_id": None,
                        "water_level_m": round(row[1], 2),
                        "min_water_level_m": round(row[2], 2),
                        "max_water_level_m": round(row[3], 2),
                        "ph": round(row[4], 2),
                        "tds_ppm": round(row[5], 1),
                        "turbidity_ntu": round(row[6], 1),
                        "dissolved_oxygen_mg_l": round(row[7], 1),
                        "temperature_c": round(row[8], 1),
                        "status": status_str,
                        "source": source_str,
                        "timestamp": row[0],
                        "reading_count": row[11],
                    })

            else:
                # Raw database rows
                raw_readings = (
                    db.query(Reading)
                    .filter(
                        Reading.well_id == well_id,
                        Reading.timestamp >= resolved_start,
                        Reading.timestamp <= resolved_end,
                    )
                    .order_by(Reading.timestamp.asc())
                    .limit(effective_limit)
                    .all()
                )

                for r in raw_readings:
                    status_str = r.status.value if hasattr(r.status, "value") else str(r.status)
                    source_str = r.source.value if hasattr(r.source, "value") else str(r.source)
                    source_breakdown[status_str] = source_breakdown.get(status_str, 0) + 1

                    readings_out.append({
                        "id": r.id,
                        "well_id": r.well_id,
                        "sensor_id": r.sensor_id,
                        "water_level_m": round(r.water_level_m, 2),
                        "min_water_level_m": round(r.water_level_m, 2),
                        "max_water_level_m": round(r.water_level_m, 2),
                        "ph": round(r.ph, 2),
                        "tds_ppm": round(r.tds_ppm, 1),
                        "turbidity_ntu": round(r.turbidity_ntu, 1),
                        "dissolved_oxygen_mg_l": round(r.dissolved_oxygen_mg_l, 1),
                        "temperature_c": round(r.temperature_c, 1),
                        "status": status_str,
                        "source": source_str,
                        "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                        "reading_count": 1,
                    })

            # Check if internal gaps exist between observations (> 14 days)
            if len(readings_out) >= 2:
                for idx in range(len(readings_out) - 1):
                    t1_str = readings_out[idx]["timestamp"]
                    t2_str = readings_out[idx + 1]["timestamp"]
                    try:
                        t1 = datetime.fromisoformat(t1_str.replace("Z", ""))
                        t2 = datetime.fromisoformat(t2_str.replace("Z", ""))
                        gap_sec = (t2 - t1).total_seconds()
                        if gap_sec > (14 * 86400):
                            has_missing_data = True
                            missing_periods.append({
                                "from": t1.isoformat(),
                                "to": t2.isoformat(),
                                "type": "INTERNAL_GAP",
                                "duration_days": round(gap_sec / 86400.0, 1),
                                "reason": f"Discontinuous telemetry gap of {round(gap_sec / 86400.0, 1)} days detected.",
                            })
                    except Exception:
                        pass

            simulated_samples = source_breakdown.get("SIMULATED", 0)
            live_samples = source_breakdown.get("LIVE", 0)
            total_samples = sum(source_breakdown.values()) or len(readings_out) or 1
            simulated_pct = round((simulated_samples / total_samples) * 100.0, 1)

            is_demo_history = (
                (getattr(well, "monitoring_type", None) or "SIMULATED").upper() == "SIMULATED"
                or simulated_pct >= 50.0
            )

            provenance_notice = (
                "DEMO / SIMULATED HISTORY: Records across this historical period were synthesized by the AquaSense Hydrological Simulation Engine for demo and workflow testing. Not collected by physical sensors."
                if is_demo_history
                else "EMPIRICAL SENSOR HISTORY: Verified records recorded by installed physical telemetry."
            )

            return {
                "well_id": well.id,
                "well_name": well.name,
                "selected_range": range_type,
                "start_date": resolved_start.isoformat(),
                "end_date": resolved_end.isoformat(),
                "aggregation": agg_mode,
                "total_records": len(readings_out),
                "has_missing_data": has_missing_data,
                "missing_periods": missing_periods,
                "data_source_summary": source_breakdown,
                "is_demo_history": is_demo_history,
                "simulated_percentage": simulated_pct,
                "simulated_records_count": simulated_samples,
                "measured_records_count": live_samples,
                "provenance_notice": provenance_notice,
                "earliest_recorded_timestamp": earliest_db_ts.isoformat() if earliest_db_ts else None,
                "latest_recorded_timestamp": latest_db_ts.isoformat() if latest_db_ts else None,
                "readings": readings_out,
            }

        finally:
            if should_close:
                db.close()
