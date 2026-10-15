from fastapi import APIRouter, Query, HTTPException
from app.services.environment_service import EnvironmentService
from app.schemas.environment import EnvironmentResponse

router = APIRouter()
env_service = EnvironmentService()

@router.get("/environment", response_model=EnvironmentResponse)
async def get_environment(lat: float = Query(...), lon: float = Query(...)):
    try:
        return await env_service.get_full_environment(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
