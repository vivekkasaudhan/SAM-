from fastapi import APIRouter, Query, HTTPException
from typing import Dict, Any, List
from datetime import datetime, timedelta
from app.simulation.engine import SyntheticEngine

router = APIRouter()


@router.get("/history", response_model=Dict[str, Any])
async def get_history(
    lat: float = Query(...),
    lon: float = Query(...),
    metric: str = Query(..., description="water_level | water_quality | air_quality"),
    hours: int = Query(24, ge=1, le=720),
    interval_minutes: int = Query(30, ge=5, le=360),
):
    """
    Return synthetic historical time-series data at configurable intervals.
    `hours` controls how far back to go; `interval_minutes` is the step size.
    """
    try:
        engine = SyntheticEngine(lat, lon)
        history: List[Dict[str, Any]] = []
        now = datetime.utcnow()

        # Generate data points from oldest → newest
        total_steps = (hours * 60) // interval_minutes
        for i in range(total_steps, -1, -1):
            t = now - timedelta(minutes=i * interval_minutes)

            # Rough rainfall proxy: small sinusoidal variation
            import math
            simulated_rainfall = max(0, 2.0 * math.sin(2 * math.pi * t.hour / 12))

            entry: Dict[str, Any] = {
                "timestamp": t.isoformat() + "Z",
                "hour": t.hour,
            }

            if metric == "water_level":
                level = engine.get_water_level(t, simulated_rainfall)
                entry["value"] = round(level, 3)
                entry["warning_level"] = round(engine.baseline_water_level + 1.2, 2)
                entry["danger_level"] = round(engine.baseline_water_level + 2.0, 2)

            elif metric == "water_quality":
                wq = engine.get_water_quality(t, simulated_rainfall)
                entry.update(wq)
                entry["value"] = wq.get("ph")

            elif metric == "air_quality":
                aq = engine.get_air_quality(t, 0.0)
                entry.update({k: v for k, v in aq.items() if k != "category"})
                entry["value"] = aq.get("aqi")
                entry["category"] = aq.get("category")

            else:
                raise HTTPException(status_code=400, detail=f"Unknown metric: {metric}. Use water_level, water_quality, or air_quality.")

            history.append(entry)

        return {
            "source": "AquaSense Simulation Engine",
            "status": "SIMULATED",
            "metric": metric,
            "lat": lat,
            "lon": lon,
            "hours": hours,
            "interval_minutes": interval_minutes,
            "data_points": len(history),
            "history": history,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
