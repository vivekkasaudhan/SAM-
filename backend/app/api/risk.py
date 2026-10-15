from fastapi import APIRouter, Query, HTTPException
from app.services.environment_service import EnvironmentService
from app.schemas.risk import RiskAssessment

router = APIRouter()
env_service = EnvironmentService()

@router.get("/risk", response_model=RiskAssessment)
async def get_risk(lat: float = Query(...), lon: float = Query(...)):
    try:
        env = await env_service.get_full_environment(lat, lon)
        return env.risk
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
