from fastapi import APIRouter, Query, HTTPException
from app.services.environment_service import EnvironmentService
from app.schemas.air_quality import AirQualityReading

router = APIRouter()
env_service = EnvironmentService()

@router.get("/air-quality", response_model=AirQualityReading)
async def get_air_quality(lat: float = Query(...), lon: float = Query(...)):
    try:
        return env_service.get_air_quality(lat, lon, 0.0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
