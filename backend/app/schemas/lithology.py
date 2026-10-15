import math
import re
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict

# ─── Geological Material Constants & Palettes ─────────────────────────────────

VALID_MATERIAL_TYPES = {
    "topsoil",
    "clay",
    "sand",
    "gravel",
    "silt",
    "sandstone",
    "limestone",
    "granite",
    "weathered_rock",
    "fractured_rock",
    "other",
}

DEFAULT_MATERIAL_COLORS: Dict[str, str] = {
    "topsoil": "#4A3525",        # Organic dark humus brown
    "clay": "#8B5A2B",           # Cohesive plastic brown-tan
    "sand": "#E6C280",           # Quartz sandy golden
    "gravel": "#A89F91",         # Coarse aggregate pebble grey
    "silt": "#C2B280",           # Pale dusty olive-khaki
    "sandstone": "#D4A373",      # Porous clastic sandstone beige
    "limestone": "#E9D8A6",      # Calcite pale cream/yellow
    "granite": "#70757A",        # Crystalline igneous granite grey
    "weathered_rock": "#9C6644", # Oxidized reddish-brown saprolite
    "fractured_rock": "#4F5D75", # Jointed slate-blue aquifer rock
    "other": "#94A3B8",          # Neutral bedrock slate
}

VALID_CONFIDENCE_LEVELS = {"HIGH", "MEDIUM", "LOW"}


def normalize_material_type(val: str) -> str:
    """Normalize user input material types to standard canonical identifiers."""
    if not val or not isinstance(val, str):
        return "other"
    cleaned = re.sub(r"[\s\-_]+", "_", val.strip().lower())
    # Handle common aliases
    if cleaned in ("soil", "top_soil"):
        return "topsoil"
    if cleaned in ("bedrock", "rock", "basement"):
        return "granite"
    if cleaned in ("shale", "mudstone"):
        return "clay"
    if cleaned in ("conglomerate", "pebbles", "cobbles"):
        return "gravel"
    if cleaned in ("fractured_sandstone", "jointed_rock"):
        return "fractured_rock"
    if cleaned in ("weathered_granite", "saprolite", "laterite"):
        return "weathered_rock"

    if cleaned in VALID_MATERIAL_TYPES:
        return cleaned
    return "other"


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class LithologyLayerBase(BaseModel):
    from_depth_m: float = Field(..., description="Top boundary depth of layer in metres (>= 0)")
    to_depth_m: float = Field(..., description="Bottom boundary depth of layer in metres (> from_depth_m)")
    material_type: str = Field(..., description="Geological material type (topsoil, clay, sand, gravel, silt, sandstone, limestone, granite, weathered_rock, fractured_rock, other)")
    description: Optional[str] = Field(None, max_length=1000, description="Field notes, texture, grain size, and visual description")
    color_code: Optional[str] = Field(None, description="HEX color representation (e.g. #D4A373) or Munsell code")
    observed_properties: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Structured properties (e.g. moisture, grain_size, hardness, permeability)")
    data_source: str = Field("CORE_SAMPLE", description="Telemetry/logging source: CORE_SAMPLE, DRILL_CUTTINGS, GEOPHYSICAL_LOG, HISTORICAL_RECORD, illustrative_demo")
    confidence_level: str = Field("HIGH", description="Data confidence: HIGH, MEDIUM, LOW")
    aquifer_indicator: Optional[bool] = Field(False, description="True if layer is identified as a water-bearing aquifer horizon")
    source_reference: Optional[str] = Field(None, max_length=255, description="Geologist log reference, bore test ID, or consultant report number")
    attachment_url: Optional[str] = Field(None, max_length=500, description="URL to borehole photo or core sample document")

    @field_validator("from_depth_m")
    @classmethod
    def validate_from_depth(cls, v: float) -> float:
        if v is None or math.isnan(v) or math.isinf(v):
            raise ValueError("Start depth (from_depth_m) must be a finite number.")
        if v < 0:
            raise ValueError("Start depth (from_depth_m) must be non-negative (>= 0 metres).")
        return round(float(v), 4)

    @field_validator("to_depth_m")
    @classmethod
    def validate_to_depth(cls, v: float) -> float:
        if v is None or math.isnan(v) or math.isinf(v):
            raise ValueError("End depth (to_depth_m) must be a finite number.")
        if v <= 0:
            raise ValueError("End depth (to_depth_m) must be strictly positive (> 0 metres).")
        return round(float(v), 4)

    @field_validator("material_type")
    @classmethod
    def validate_material(cls, v: str) -> str:
        return normalize_material_type(v)

    @field_validator("confidence_level")
    @classmethod
    def validate_confidence(cls, v: str) -> str:
        upper = (v or "HIGH").strip().upper()
        if upper not in VALID_CONFIDENCE_LEVELS:
            return "MEDIUM"
        return upper

    @field_validator("color_code")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip()
        if re.match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", v):
            return v.upper()
        return v

    @model_validator(mode="after")
    def validate_interval_order(self) -> "LithologyLayerBase":
        if self.to_depth_m <= self.from_depth_m:
            raise ValueError(
                f"End depth ({self.to_depth_m}m) must be strictly greater than start depth ({self.from_depth_m}m)."
            )
        # Assign default color code if not provided
        if not self.color_code:
            self.color_code = DEFAULT_MATERIAL_COLORS.get(self.material_type, DEFAULT_MATERIAL_COLORS["other"])
        return self


class LithologyLayerCreate(LithologyLayerBase):
    pass


class LithologyLayerUpdate(BaseModel):
    from_depth_m: Optional[float] = None
    to_depth_m: Optional[float] = None
    material_type: Optional[str] = None
    description: Optional[str] = None
    color_code: Optional[str] = None
    observed_properties: Optional[Dict[str, Any]] = None
    data_source: Optional[str] = None
    confidence_level: Optional[str] = None
    aquifer_indicator: Optional[bool] = None
    source_reference: Optional[str] = None
    attachment_url: Optional[str] = None

    @field_validator("from_depth_m")
    @classmethod
    def validate_from_depth(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        if math.isnan(v) or math.isinf(v):
            raise ValueError("Start depth (from_depth_m) must be a finite number.")
        if v < 0:
            raise ValueError("Start depth (from_depth_m) must be non-negative (>= 0 metres).")
        return round(float(v), 4)

    @field_validator("to_depth_m")
    @classmethod
    def validate_to_depth(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        if math.isnan(v) or math.isinf(v):
            raise ValueError("End depth (to_depth_m) must be a finite number.")
        if v <= 0:
            raise ValueError("End depth (to_depth_m) must be strictly positive (> 0 metres).")
        return round(float(v), 4)

    @field_validator("material_type")
    @classmethod
    def validate_material(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return normalize_material_type(v)

    @field_validator("confidence_level")
    @classmethod
    def validate_confidence(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        upper = v.strip().upper()
        if upper not in VALID_CONFIDENCE_LEVELS:
            return "MEDIUM"
        return upper


class LithologyLayerOut(BaseModel):
    id: int
    well_id: str
    from_depth_m: float
    to_depth_m: float
    thickness_m: float
    material_type: str
    description: Optional[str] = None
    color_code: Optional[str] = None
    observed_properties: Optional[Dict[str, Any]] = None
    data_source: str
    confidence_level: str
    aquifer_indicator: bool = False
    source_reference: Optional[str] = None
    attachment_url: Optional[str] = None
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    creator_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DepthGap(BaseModel):
    from_depth_m: float
    to_depth_m: float
    length_m: float


class GeologyProfileOut(BaseModel):
    well_id: str
    well_name: str
    well_total_depth_m: Optional[float] = None
    total_logged_depth_m: float
    layer_count: int
    aquifer_layers_count: int
    has_aquifer_layer: bool
    depth_coverage_pct: float
    logged_thickness_m: float
    gaps: List[DepthGap]
    dominant_material: Optional[str] = None
    data_confidence_summary: Dict[str, int]
    stratigraphic_column: List[LithologyLayerOut]

    model_config = ConfigDict(from_attributes=True)
