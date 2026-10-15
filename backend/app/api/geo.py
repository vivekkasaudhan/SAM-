"""
Geographic Hierarchy APIs for AquaSense.
Provides cascading lookup: Country -> State -> District -> City.
"""

from fastapi import APIRouter, Query, Depends
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.auth import get_db
from app.services.geo_service import GeoService

router = APIRouter(prefix="/geo", tags=["Geographic Hierarchy"])
geo_service = GeoService()


@router.get("/countries", response_model=List[str])
def get_countries(db: Session = Depends(get_db)):
    """Return all available countries."""
    return geo_service.get_countries(db=db)


@router.get("/states", response_model=List[str])
def get_states(
    country: Optional[str] = Query("India", description="Country name"),
    db: Session = Depends(get_db),
):
    """Return states for a country (defaults to India)."""
    return geo_service.get_states(country=country, db=db)


@router.get("/districts", response_model=List[str])
def get_districts(
    state: str = Query(..., description="State name (e.g., Jharkhand)"),
    country: Optional[str] = Query("India", description="Country name"),
    db: Session = Depends(get_db),
):
    """Return districts for a state."""
    return geo_service.get_districts(country=country, state=state, db=db)


@router.get("/cities", response_model=List[str])
def get_cities(
    district: Optional[str] = Query(None, description="District name (e.g., East Singhbhum)"),
    state: Optional[str] = Query(None, description="State name (e.g., Jharkhand)"),
    country: Optional[str] = Query("India", description="Country name"),
    db: Session = Depends(get_db),
):
    """Return cities for a district, or for an entire state if district is omitted."""
    return geo_service.get_cities(country=country, state=state, district=district, db=db)


@router.get("/hierarchy", response_model=Dict[str, Any])
def get_hierarchy(
    country: Optional[str] = Query("India", description="Country name"),
    state: Optional[str] = Query(None, description="Optional state name"),
):
    """Return nested hierarchy tree for building UI cascading selectors."""
    return geo_service.get_hierarchy_tree(country=country, state=state)


@router.get("/resolve", response_model=Dict[str, Optional[str]])
def resolve_coordinates(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
):
    """Resolve Country -> State -> District -> City from coordinates."""
    return geo_service.resolve_hierarchy_by_coordinates(lat, lon)
