from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_db, get_current_user, get_optional_user, is_main_admin
from app.models.database import Well, LithologyLayer, User
from app.schemas.lithology import (
    LithologyLayerCreate,
    LithologyLayerUpdate,
    LithologyLayerOut,
    GeologyProfileOut,
)
from app.services.lithology_service import LithologyService

router = APIRouter()


def _get_well_with_permission(
    well_id: str,
    db: Session,
    current_user: Optional[User],
    require_write: bool = False,
) -> Well:
    """
    Fetches the requested Well and enforces AquaSense Role-Based Access Control.
    - Read operations: Permitted for authenticated Subadmins, Main Admins, and public viewers.
    - Write/Mutating operations:
        - Main Admin: Allowed for all wells.
        - Subadmin: Allowed ONLY for wells created by their account.
        - Unauthenticated: Rejected with 401 Unauthorized.
    """
    well = db.query(Well).filter(Well.id == well_id).first()
    if not well:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Monitoring well '{well_id}' was not found in station registry.",
        )

    if require_write:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication credentials are required to modify lithological strata.",
            )
        if not is_main_admin(current_user) and well.created_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Forbidden: You do not have permission to modify lithology for station '{well.name}' "
                    f"({well.id}). This station is owned by another administrator."
                ),
            )

    return well


# ─── 1. List Lithology Layers for a Well ──────────────────────────────────────

@router.get(
    "/wells/{well_id}/lithology",
    response_model=List[LithologyLayerOut],
    summary="List all stratigraphic lithology layers for a station",
)
def list_well_lithology_layers(
    well_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Returns all logged subsurface lithology intervals for a specific well,
    sorted by start depth (from_depth_m ascending).
    """
    well = _get_well_with_permission(well_id, db, current_user, require_write=False)
    layers = (
        db.query(LithologyLayer)
        .filter(LithologyLayer.well_id == well.id)
        .order_by(LithologyLayer.from_depth_m.asc(), LithologyLayer.to_depth_m.asc())
        .all()
    )
    return [LithologyService.format_layer_out(l) for l in layers]


# ─── 2. Geological & Stratigraphic Profile ────────────────────────────────────

@router.get(
    "/wells/{well_id}/lithology/profile",
    response_model=GeologyProfileOut,
    summary="Retrieve comprehensive geological and stratigraphic profile for a well",
)
@router.get(
    "/wells/{well_id}/geology-profile",
    response_model=GeologyProfileOut,
    summary="Retrieve geological profile (alias)",
    include_in_schema=False,
)
def get_well_geological_profile(
    well_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Computes and returns a rich geological profile:
    - Stratigraphic column sequence
    - Total logged depth and thickness
    - Logging gaps (intervals without documented geology)
    - Depth coverage percentage
    - Water-bearing aquifer horizons summary
    - Dominant material classification
    - Data confidence metrics (High/Medium/Low)
    """
    well = _get_well_with_permission(well_id, db, current_user, require_write=False)
    layers = (
        db.query(LithologyLayer)
        .filter(LithologyLayer.well_id == well.id)
        .order_by(LithologyLayer.from_depth_m.asc())
        .all()
    )
    return LithologyService.build_geology_profile(well, layers)


# ─── 3. Get Single Layer by ID ────────────────────────────────────────────────

@router.get(
    "/wells/{well_id}/lithology/{layer_id}",
    response_model=LithologyLayerOut,
    summary="Retrieve a specific lithology layer by ID",
)
def get_well_lithology_layer(
    well_id: str,
    layer_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    well = _get_well_with_permission(well_id, db, current_user, require_write=False)
    layer = db.query(LithologyLayer).filter(LithologyLayer.id == layer_id).first()
    if not layer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lithology layer #{layer_id} does not exist.",
        )
    if layer.well_id != well.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lithology layer #{layer_id} belongs to station '{layer.well_id}', not '{well.id}'.",
        )
    return LithologyService.format_layer_out(layer)


@router.get(
    "/lithology/{layer_id}",
    response_model=LithologyLayerOut,
    summary="Retrieve lithology layer by ID (direct)",
)
def get_lithology_layer_direct(
    layer_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    layer = db.query(LithologyLayer).filter(LithologyLayer.id == layer_id).first()
    if not layer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lithology layer #{layer_id} does not exist.",
        )
    return LithologyService.format_layer_out(layer)


# ─── 4. Create New Lithology Layer ───────────────────────────────────────────

@router.post(
    "/wells/{well_id}/lithology",
    response_model=LithologyLayerOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a subsurface geological layer to a station",
)
def create_lithology_layer(
    well_id: str,
    payload: LithologyLayerCreate,
    allow_overlap: bool = Query(False, description="Explicitly allow overlapping intervals (e.g. fault zones)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Creates a new lithological strata layer.
    - Start depth must be non-negative.
    - End depth must be strictly greater than start depth.
    - Gaps in logged intervals are allowed.
    - Overlapping intervals are prevented by default.
    - Main Admin can add layers to any well; Subadmins can only add to wells they created.
    """
    well = _get_well_with_permission(well_id, db, current_user, require_write=True)
    layer = LithologyService.create_layer(
        db=db,
        well=well,
        payload=payload,
        current_user=current_user,
        allow_overlap=allow_overlap,
    )
    return LithologyService.format_layer_out(layer)


# ─── 5. Update Existing Lithology Layer ───────────────────────────────────────

@router.put(
    "/wells/{well_id}/lithology/{layer_id}",
    response_model=LithologyLayerOut,
    summary="Update attributes and depth bounds of a lithology layer",
)
@router.patch(
    "/wells/{well_id}/lithology/{layer_id}",
    response_model=LithologyLayerOut,
    summary="Partially update a lithology layer",
    include_in_schema=False,
)
def update_lithology_layer(
    well_id: str,
    layer_id: int,
    payload: LithologyLayerUpdate,
    allow_overlap: bool = Query(False, description="Explicitly allow overlapping intervals"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Modifies an existing lithological layer.
    - Validates edits against neighboring intervals excluding this layer.
    - Preserves authorization boundaries (Main Admin or well creator).
    - Records authenticated updater user ID and timestamp.
    """
    well = _get_well_with_permission(well_id, db, current_user, require_write=True)
    layer = db.query(LithologyLayer).filter(LithologyLayer.id == layer_id).first()
    if not layer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lithology layer #{layer_id} does not exist.",
        )
    if layer.well_id != well.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lithology layer #{layer_id} does not belong to well '{well.id}'.",
        )

    updated_layer = LithologyService.update_layer(
        db=db,
        well=well,
        layer=layer,
        payload=payload,
        current_user=current_user,
        allow_overlap=allow_overlap,
    )
    return LithologyService.format_layer_out(updated_layer)


# ─── 6. Delete Lithology Layer ────────────────────────────────────────────────

@router.delete(
    "/wells/{well_id}/lithology/{layer_id}",
    summary="Permanently remove a lithology layer from a station",
)
def delete_lithology_layer(
    well_id: str,
    layer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Permanently deletes a lithology layer.
    - Main Admin can delete any layer.
    - Subadmin can only delete layers on wells they created.
    """
    well = _get_well_with_permission(well_id, db, current_user, require_write=True)
    layer = db.query(LithologyLayer).filter(LithologyLayer.id == layer_id).first()
    if not layer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lithology layer #{layer_id} does not exist.",
        )
    if layer.well_id != well.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lithology layer #{layer_id} does not belong to well '{well.id}'.",
        )

    LithologyService.delete_layer(db, layer)
    return {
        "status": "success",
        "message": f"Lithology layer #{layer_id} ({layer.material_type}, {layer.from_depth_m}m - {layer.to_depth_m}m) permanently removed.",
        "id": layer_id,
        "well_id": well.id,
    }


# ─── 7. Seed Illustrative Demo Stratigraphy ───────────────────────────────────

@router.post(
    "/wells/{well_id}/lithology/seed-demo",
    response_model=List[LithologyLayerOut],
    status_code=status.HTTP_201_CREATED,
    summary="Seed illustrative demo lithology layers for a station (explicit action)",
)
def seed_demo_lithology(
    well_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Attaches an illustrative educational stratigraphic sequence to a well.
    - Only available upon explicit request.
    - All created records are explicitly labeled with data_source='illustrative_demo'.
    - Never automatically attached to real physical wells.
    - Main Admin or well owner authorized.
    """
    well = _get_well_with_permission(well_id, db, current_user, require_write=True)
    layers = LithologyService.seed_illustrative_demo_layers(db, well, current_user)
    return [LithologyService.format_layer_out(l) for l in layers]
