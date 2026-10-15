from fastapi import APIRouter, Query, HTTPException
from app.services.environment_service import EnvironmentService
from app.schemas.water import WaterLevelReading, WaterQualityReading

router = APIRouter()
env_service = EnvironmentService()

@router.get("/water", response_model=WaterLevelReading)
async def get_water_level(lat: float = Query(...), lon: float = Query(...)):
    try:
        # Assuming no recent rainfall for independent call
        return env_service.get_water_level(lat, lon, 0.0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/water-quality", response_model=WaterQualityReading)
async def get_water_quality(lat: float = Query(...), lon: float = Query(...)):
    try:
        return env_service.get_water_quality(lat, lon, 0.0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
