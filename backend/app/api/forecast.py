from fastapi import APIRouter, Query, HTTPException
from typing import Dict, Any
from app.services.environment_service import EnvironmentService

router = APIRouter()
env_service = EnvironmentService()


@router.get("/forecast", response_model=Dict[str, Any])
async def get_forecast(
    lat: float = Query(...),
    lon: float = Query(...),
    hours: int = Query(48, ge=1, le=168),
):
    """
    Returns hourly weather forecast data reshaped for easy frontend consumption.
    Gracefully uses live Open-Meteo or high-fidelity simulation.
    """
    try:
        weather_data = await env_service.weather_provider.get_raw_weather(lat, lon)
        is_live = weather_data.get("_is_live", False)

        hourly = weather_data.get("hourly", {})
        daily = weather_data.get("daily", {})

        times = hourly.get("time", [])
        temps = hourly.get("temperature_2m", [])
        humidity = hourly.get("relative_humidity_2m", [])
        precip = hourly.get("precipitation", [])
        wind = hourly.get("wind_speed_10m", [])
        uv = hourly.get("uv_index", [])

        from datetime import datetime
        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:00")
        try:
            start_idx = next(i for i, t in enumerate(times) if t >= now_str)
        except StopIteration:
            start_idx = 0

        end_idx = min(start_idx + hours, len(times))

        daily_codes = daily.get("weather_code", [])
        daily_max = daily.get("temperature_2m_max", [])
        daily_min = daily.get("temperature_2m_min", [])
        daily_precip_sum = daily.get("precipitation_sum", [])

        return {
            "source": "Open-Meteo" if is_live else "AquaSense Simulation Engine",
            "status": "LIVE" if is_live else "SIMULATED",
            "lat": lat,
            "lon": lon,
            "forecast": {
                "time": times[start_idx:end_idx],
                "temperature_2m": temps[start_idx:end_idx],
                "relative_humidity_2m": humidity[start_idx:end_idx],
                "precipitation": precip[start_idx:end_idx],
                "wind_speed_10m": wind[start_idx:end_idx],
                "uv_index": uv[start_idx:end_idx],
                "daily_weather_codes": daily_codes[:7],
                "daily_max_temp": daily_max[:7],
                "daily_min_temp": daily_min[:7],
                "daily_precip": daily_precip_sum[:7],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast/groundwater/{well_id}")
@router.get("/forecast/wells/{well_id}")
def get_groundwater_forecast(
    well_id: str,
    horizon: int = Query(7, ge=1, le=15, description="Forecast horizon in days (1 to 15)"),
    include_backtest: bool = Query(True, description="Include chronological holdout backtest evaluation"),
    persist: bool = Query(False, description="Persist generated forecast into water_level_forecasts table"),
):
    """
    Groundwater level forecast endpoint.
    Routes to GroundwaterForecastingService for hydrological baseline modeling and validation.
    """
    from app.services.forecasting_service import GroundwaterForecastingService
    from app.models.database import SessionLocal, Well

    db = SessionLocal()
    try:
        w = db.query(Well).filter(Well.id == well_id).first()
        if not w:
            raise HTTPException(status_code=404, detail=f"Well station '{well_id}' was not found.")

        service = GroundwaterForecastingService(db=db)
        return service.generate_forecast(
            well_id=well_id,
            horizon_days=horizon,
            include_backtest=include_backtest,
            persist=persist,
            db=db,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groundwater forecasting failed: {str(e)}")
    finally:
        db.close()

