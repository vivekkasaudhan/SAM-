import math
from typing import List, Optional, Dict, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.database import Well, LithologyLayer, User
from app.schemas.lithology import (
    LithologyLayerCreate,
    LithologyLayerUpdate,
    LithologyLayerOut,
    GeologyProfileOut,
    DepthGap,
    DEFAULT_MATERIAL_COLORS,
)


class LithologyService:

    @staticmethod
    def validate_interval_bounds(from_depth_m: float, to_depth_m: float):
        """Validate single interval mathematical validity."""
        if math.isnan(from_depth_m) or math.isinf(from_depth_m):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Start depth (from_depth_m) must be a finite number.",
            )
        if math.isnan(to_depth_m) or math.isinf(to_depth_m):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="End depth (to_depth_m) must be a finite number.",
            )
        if from_depth_m < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Start depth ({from_depth_m}m) must be non-negative (>= 0m).",
            )
        if to_depth_m <= from_depth_m:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"End depth ({to_depth_m}m) must be strictly greater than start depth ({from_depth_m}m).",
            )

    @staticmethod
    def validate_against_well_depth(to_depth_m: float, well_total_depth_m: Optional[float]):
        """
        Policy: If well total depth is documented and positive, stratigraphic intervals
        must not exceed the borehole termination depth unless explicitly overridden.
        """
        if well_total_depth_m and well_total_depth_m > 0:
            if to_depth_m > (well_total_depth_m + 0.05):  # 5cm tolerance for measurement noise
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Layer bottom boundary ({to_depth_m:.2f}m) exceeds the station's "
                        f"documented total depth ({well_total_depth_m:.2f}m). "
                        "Please adjust depth interval or update station total depth."
                    ),
                )

    @classmethod
    def check_layer_overlaps(
        cls,
        db: Session,
        well_id: str,
        from_depth_m: float,
        to_depth_m: float,
        exclude_layer_id: Optional[int] = None,
        allow_overlap: bool = False,
    ):
        """
        Validates interval against all other existing layers in the well.
        Touching boundaries (e.g. 0-5m and 5-10m) are valid and do NOT overlap.
        Gaps (e.g. 0-5m and 8-12m) are valid.
        """
        if allow_overlap:
            return

        query = db.query(LithologyLayer).filter(LithologyLayer.well_id == well_id)
        if exclude_layer_id:
            query = query.filter(LithologyLayer.id != exclude_layer_id)

        existing_layers = query.all()

        for layer in existing_layers:
            # Overlap occurs if max(start1, start2) < min(end1, end2)
            overlap_start = max(from_depth_m, layer.from_depth_m)
            overlap_end = min(to_depth_m, layer.to_depth_m)

            if overlap_start < overlap_end:
                overlap_len = round(overlap_end - overlap_start, 3)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Depth interval [{from_depth_m}m - {to_depth_m}m] overlaps with existing layer "
                        f"#{layer.id} [{layer.from_depth_m}m - {layer.to_depth_m}m: {layer.material_type}] "
                        f"by {overlap_len}m. Modify depth bounds to remove overlap. "
                        "(Adjacent boundaries that touch at exact depths are permitted)."
                    ),
                )

    @classmethod
    def create_layer(
        cls,
        db: Session,
        well: Well,
        payload: LithologyLayerCreate,
        current_user: User,
        allow_overlap: bool = False,
    ) -> LithologyLayer:
        cls.validate_interval_bounds(payload.from_depth_m, payload.to_depth_m)
        cls.validate_against_well_depth(payload.to_depth_m, well.total_depth_m)
        cls.check_layer_overlaps(
            db,
            well.id,
            payload.from_depth_m,
            payload.to_depth_m,
            exclude_layer_id=None,
            allow_overlap=allow_overlap,
        )

        color = payload.color_code or DEFAULT_MATERIAL_COLORS.get(
            payload.material_type, DEFAULT_MATERIAL_COLORS["other"]
        )

        layer = LithologyLayer(
            well_id=well.id,
            from_depth_m=payload.from_depth_m,
            to_depth_m=payload.to_depth_m,
            material_type=payload.material_type,
            description=payload.description,
            color_code=color,
            observed_properties=payload.observed_properties or {},
            data_source=payload.data_source or "CORE_SAMPLE",
            confidence_level=payload.confidence_level or "HIGH",
            aquifer_indicator=bool(payload.aquifer_indicator),
            source_reference=payload.source_reference,
            attachment_url=payload.attachment_url,
            created_by_user_id=current_user.id,
            updated_by_user_id=current_user.id,
        )

        db.add(layer)
        db.commit()
        db.refresh(layer)
        return layer

    @classmethod
    def update_layer(
        cls,
        db: Session,
        well: Well,
        layer: LithologyLayer,
        payload: LithologyLayerUpdate,
        current_user: User,
        allow_overlap: bool = False,
    ) -> LithologyLayer:
        new_from = payload.from_depth_m if payload.from_depth_m is not None else layer.from_depth_m
        new_to = payload.to_depth_m if payload.to_depth_m is not None else layer.to_depth_m

        cls.validate_interval_bounds(new_from, new_to)
        cls.validate_against_well_depth(new_to, well.total_depth_m)

        # Validate against neighboring intervals excluding this layer
        cls.check_layer_overlaps(
            db,
            well.id,
            new_from,
            new_to,
            exclude_layer_id=layer.id,
            allow_overlap=allow_overlap,
        )

        # Apply updates
        if payload.from_depth_m is not None:
            layer.from_depth_m = payload.from_depth_m
        if payload.to_depth_m is not None:
            layer.to_depth_m = payload.to_depth_m
        if payload.material_type is not None:
            layer.material_type = payload.material_type
            if not payload.color_code:
                layer.color_code = DEFAULT_MATERIAL_COLORS.get(
                    payload.material_type, DEFAULT_MATERIAL_COLORS["other"]
                )
        if payload.color_code is not None:
            layer.color_code = payload.color_code
        if payload.description is not None:
            layer.description = payload.description
        if payload.observed_properties is not None:
            layer.observed_properties = payload.observed_properties
        if payload.data_source is not None:
            layer.data_source = payload.data_source
        if payload.confidence_level is not None:
            layer.confidence_level = payload.confidence_level
        if payload.aquifer_indicator is not None:
            layer.aquifer_indicator = payload.aquifer_indicator
        if payload.source_reference is not None:
            layer.source_reference = payload.source_reference
        if payload.attachment_url is not None:
            layer.attachment_url = payload.attachment_url

        layer.updated_by_user_id = current_user.id

        db.commit()
        db.refresh(layer)
        return layer

    @classmethod
    def delete_layer(cls, db: Session, layer: LithologyLayer):
        db.delete(layer)
        db.commit()

    @classmethod
    def format_layer_out(cls, layer: LithologyLayer) -> LithologyLayerOut:
        creator_name = None
        if layer.creator:
            creator_name = layer.creator.full_name or layer.creator.username

        thickness = round(max(0.0, layer.to_depth_m - layer.from_depth_m), 4)

        return LithologyLayerOut(
            id=layer.id,
            well_id=layer.well_id,
            from_depth_m=layer.from_depth_m,
            to_depth_m=layer.to_depth_m,
            thickness_m=thickness,
            material_type=layer.material_type,
            description=layer.description,
            color_code=layer.color_code or DEFAULT_MATERIAL_COLORS.get(layer.material_type, "#94A3B8"),
            observed_properties=layer.observed_properties or {},
            data_source=layer.data_source,
            confidence_level=layer.confidence_level,
            aquifer_indicator=bool(layer.aquifer_indicator),
            source_reference=layer.source_reference,
            attachment_url=layer.attachment_url,
            created_by_user_id=layer.created_by_user_id,
            updated_by_user_id=layer.updated_by_user_id,
            created_at=layer.created_at,
            updated_at=layer.updated_at,
            creator_name=creator_name,
        )

    @classmethod
    def build_geology_profile(cls, well: Well, layers: List[LithologyLayer]) -> GeologyProfileOut:
        sorted_layers = sorted(layers, key=lambda l: (l.from_depth_m, l.to_depth_m))
        formatted_layers = [cls.format_layer_out(l) for l in sorted_layers]

        layer_count = len(sorted_layers)
        aquifer_count = sum(1 for l in sorted_layers if l.aquifer_indicator)
        total_logged_depth_m = max((l.to_depth_m for l in sorted_layers), default=0.0)

        # Calculate thickness and gaps
        total_logged_thickness = 0.0
        gaps: List[DepthGap] = []
        material_thickness: Dict[str, float] = {}
        confidence_counts: Dict[str, int] = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}

        current_cursor = 0.0
        for l in sorted_layers:
            # Check gap from previous cursor
            if l.from_depth_m > current_cursor:
                gap_len = round(l.from_depth_m - current_cursor, 4)
                if gap_len > 0.001:
                    gaps.append(DepthGap(
                        from_depth_m=round(current_cursor, 4),
                        to_depth_m=round(l.from_depth_m, 4),
                        length_m=gap_len,
                    ))

            thick = max(0.0, l.to_depth_m - l.from_depth_m)
            total_logged_thickness += thick
            material_thickness[l.material_type] = material_thickness.get(l.material_type, 0.0) + thick

            conf = (l.confidence_level or "HIGH").upper()
            confidence_counts[conf] = confidence_counts.get(conf, 0) + 1

            current_cursor = max(current_cursor, l.to_depth_m)

        # Dominant material
        dominant_material = None
        if material_thickness:
            dominant_material = max(material_thickness.items(), key=lambda item: item[1])[0]

        # Coverage percentage
        depth_coverage_pct = 100.0
        if total_logged_depth_m > 0:
            depth_coverage_pct = round((total_logged_thickness / total_logged_depth_m) * 100.0, 1)

        return GeologyProfileOut(
            well_id=well.id,
            well_name=well.name,
            well_total_depth_m=well.total_depth_m,
            total_logged_depth_m=round(total_logged_depth_m, 4),
            layer_count=layer_count,
            aquifer_layers_count=aquifer_count,
            has_aquifer_layer=aquifer_count > 0,
            depth_coverage_pct=depth_coverage_pct,
            logged_thickness_m=round(total_logged_thickness, 4),
            gaps=gaps,
            dominant_material=dominant_material,
            data_confidence_summary=confidence_counts,
            stratigraphic_column=formatted_layers,
        )

    @classmethod
    def seed_illustrative_demo_layers(
        cls, db: Session, well: Well, current_user: User
    ) -> List[LithologyLayer]:
        """
        Creates an illustrative demo geological sequence for a well upon explicit request.
        Tagged explicitly as 'illustrative_demo' to never confuse with physical core logs.
        """
        # Clear any existing illustrative demo layers for this well first
        db.query(LithologyLayer).filter(
            LithologyLayer.well_id == well.id,
            LithologyLayer.data_source == "illustrative_demo",
        ).delete()

        demo_sequence = [
            {
                "from_depth_m": 0.0,
                "to_depth_m": 1.2,
                "material_type": "topsoil",
                "description": "Dark brown humic topsoil with organic matter and silt loam texture",
                "color_code": DEFAULT_MATERIAL_COLORS["topsoil"],
                "observed_properties": {"moisture": "damp", "grain_size": "fine", "hardness": "soft"},
                "aquifer_indicator": False,
            },
            {
                "from_depth_m": 1.2,
                "to_depth_m": 4.5,
                "material_type": "silt",
                "description": "Buff-colored alluvial silt with fine sand laminations; moderate compaction",
                "color_code": DEFAULT_MATERIAL_COLORS["silt"],
                "observed_properties": {"moisture": "damp", "grain_size": "fine", "hardness": "medium"},
                "aquifer_indicator": False,
            },
            {
                "from_depth_m": 4.5,
                "to_depth_m": 9.0,
                "material_type": "clay",
                "description": "Dense impermeable reddish-brown plastic clay; primary confining aquitard unit",
                "color_code": DEFAULT_MATERIAL_COLORS["clay"],
                "observed_properties": {"moisture": "saturated", "permeability_m_day": 0.002, "hardness": "firm"},
                "aquifer_indicator": False,
            },
            {
                "from_depth_m": 9.0,
                "to_depth_m": 18.5,
                "material_type": "sand",
                "description": "Coarse quartz sand with rounded gravel clasts; prolific productive water-bearing unconfined aquifer",
                "color_code": DEFAULT_MATERIAL_COLORS["sand"],
                "observed_properties": {"moisture": "saturated", "permeability_m_day": 24.5, "hardness": "loose"},
                "aquifer_indicator": True,
            },
            {
                "from_depth_m": 18.5,
                "to_depth_m": 28.0,
                "material_type": "sandstone",
                "description": "Fine-grained porous feldspathic sandstone with secondary bedding-plane fractures",
                "color_code": DEFAULT_MATERIAL_COLORS["sandstone"],
                "observed_properties": {"moisture": "saturated", "hardness": "moderately_hard"},
                "aquifer_indicator": True,
            },
            {
                "from_depth_m": 28.0,
                "to_depth_m": 35.0,
                "material_type": "granite",
                "description": "Unweathered pink-grey crystalline granite bedrock; impermeable hydrogeological basement",
                "color_code": DEFAULT_MATERIAL_COLORS["granite"],
                "observed_properties": {"moisture": "dry", "hardness": "very_hard", "fracture_density": "sparse"},
                "aquifer_indicator": False,
            },
        ]

        created_layers: List[LithologyLayer] = []
        for item in demo_sequence:
            layer = LithologyLayer(
                well_id=well.id,
                from_depth_m=item["from_depth_m"],
                to_depth_m=item["to_depth_m"],
                material_type=item["material_type"],
                description=item["description"],
                color_code=item["color_code"],
                observed_properties=item["observed_properties"],
                data_source="illustrative_demo",
                confidence_level="HIGH",
                aquifer_indicator=item["aquifer_indicator"],
                source_reference="AquaSense Illustrative Hydrogeological Model (Demo)",
                attachment_url=None,
                created_by_user_id=current_user.id,
                updated_by_user_id=current_user.id,
            )
            db.add(layer)
            created_layers.append(layer)

        db.commit()
        for l in created_layers:
            db.refresh(l)
        return created_layers
