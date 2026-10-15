from fastapi import APIRouter, Query, HTTPException
from typing import Dict, Any, List
from datetime import datetime, timedelta
import math
from app.simulation.engine import SyntheticEngine

router = APIRouter()


@router.get("/analytics", response_model=Dict[str, Any])
async def get_analytics(
    lat: float = Query(...),
    lon: float = Query(...),
    comparison: str = Query(
        "rainfall_vs_water_level",
        description="rainfall_vs_water_level | temp_vs_water_temp | rainfall_vs_turbidity | water_level_vs_flood_risk | ph_vs_time | turbidity_vs_time"
    ),
    hours: int = Query(48, ge=6, le=168),
):
    """
    Returns aligned historical and comparative time-series data for environmental analytics.
    """
    try:
        engine = SyntheticEngine(lat, lon)
        now = datetime.utcnow()
        points = []

        for i in range(hours, -1, -1):
            t = now - timedelta(hours=i)
            hour = t.hour

            # Deterministic rainfall variation
            simulated_rain = max(0.0, 3.2 * math.sin(2 * math.pi * hour / 12 + lat))
            w = engine.get_weather(t)
            wl = engine.get_water_level(t, simulated_rain)
            wq = engine.get_water_quality(t, simulated_rain)

            # Flood risk calculation for this point
            flood_score = min(100.0, max(5.0, (wl / 6.5) * 60.0 + simulated_rain * 6.0))

            point: Dict[str, Any] = {
                "timestamp": t.strftime("%Y-%m-%dT%H:00:00Z"),
                "display_time": t.strftime("%d %b %H:%M"),
                "source": "AquaSense Analytics Engine",
            }

            if comparison == "rainfall_vs_water_level":
                point["rainfall_mm"] = round(simulated_rain, 1)
                point["water_level_m"] = round(wl, 2)
                point["warning_level_m"] = 5.5
                point["danger_level_m"] = 6.2
            elif comparison == "temp_vs_water_temp":
                point["air_temp_c"] = round(w["temperature_2m"], 1)
                point["water_temp_c"] = round(wq["temperature"], 1)
            elif comparison == "rainfall_vs_turbidity":
                point["rainfall_mm"] = round(simulated_rain, 1)
                point["turbidity_ntu"] = round(wq["turbidity"], 1)
            elif comparison == "water_level_vs_flood_risk":
                point["water_level_m"] = round(wl, 2)
                point["flood_risk_score"] = round(flood_score, 1)
            elif comparison == "ph_vs_time":
                point["ph"] = round(wq["ph"], 2)
                point["min_safe"] = 6.5
                point["max_safe"] = 8.5
            elif comparison == "turbidity_vs_time":
                point["turbidity_ntu"] = round(wq["turbidity"], 1)
                point["threshold"] = 10.0
            else:
                raise HTTPException(status_code=400, detail=f"Unknown comparison: {comparison}")

            points.append(point)

        return {
            "comparison": comparison,
            "lat": lat,
            "lon": lon,
            "hours": hours,
            "data_points": len(points),
            "data": points,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
