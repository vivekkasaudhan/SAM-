from fastapi import APIRouter, Query, HTTPException
from app.services.environment_service import EnvironmentService
from app.schemas.weather import WeatherReading, WeatherForecast

router = APIRouter()
env_service = EnvironmentService()

@router.get("/weather", response_model=WeatherReading)
async def get_weather(lat: float = Query(...), lon: float = Query(...)):
    try:
        return await env_service.get_weather(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
