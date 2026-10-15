from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any
from app.services.location_service import LocationService
from app.schemas.location import LocationInfo

router = APIRouter()
location_service = LocationService()


@router.get("/location/reverse", response_model=LocationInfo)
async def reverse_geocode(lat: float = Query(...), lon: float = Query(...)):
    try:
        return await location_service.reverse_geocode(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/location/search", response_model=List[Dict[str, Any]])
async def search_locations(q: str = Query(..., min_length=1)):
    try:
        return await location_service.search_locations(q)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
