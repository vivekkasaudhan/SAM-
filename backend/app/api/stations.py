from fastapi import APIRouter, Query, HTTPException
from typing import List
from app.services.station_service import StationService
from app.schemas.location import NearbyStation

router = APIRouter()
station_service = StationService()

@router.get("/stations/nearby", response_model=List[NearbyStation])
async def get_nearby_stations(lat: float = Query(...), lon: float = Query(...), radius_km: float = Query(50.0)):
    try:
        return station_service.get_nearby_stations(lat, lon, radius_km)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
