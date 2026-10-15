from pydantic import BaseModel
from typing import List, Optional
from .base import BaseReading, DataSourceInfo


class WaterLevelReading(BaseReading):
    water_level: float
    trend: str  # "RISING", "FALLING", "STABLE"
    daily_variation: float
    warning_level_m: float = 5.5
    danger_level_m: float = 6.5
    historical_max_m: Optional[float] = None
    flow_rate_cumecs: Optional[float] = None
    change_1h_m: Optional[float] = None
    nearest_station: Optional[str] = None
    nearest_station_distance_km: Optional[float] = None

    @property
    def status(self) -> str:
        if self.water_level >= self.danger_level_m:
            return "DANGER"
        elif self.water_level >= self.warning_level_m:
            return "WARNING"
        return "NORMAL"

    @property
    def percentage_of_danger(self) -> float:
        return round((self.water_level / self.danger_level_m) * 100, 1)


class WaterQualityReading(BaseReading):
    ph: float
    turbidity: float
    tds: float
    temperature: float
    dissolved_oxygen: float
    electrical_conductivity: Optional[float] = None
    category: str = "GOOD"  # "GOOD", "MODERATE", "POOR", "DANGEROUS"

    @staticmethod
    def compute_category(ph: float, turbidity: float, tds: float) -> str:
        """Rule-based water quality categorization."""
        if ph < 6.0 or ph > 9.0 or turbidity > 100 or tds > 1000:
            return "DANGEROUS"
        if ph < 6.5 or ph > 8.5 or turbidity > 25 or tds > 500:
            return "POOR"
        if ph < 7.0 or ph > 8.0 or turbidity > 10 or tds > 350:
            return "MODERATE"
        return "GOOD"


class WaterQualityHistory(BaseModel):
    data_source: DataSourceInfo
    history: List[WaterQualityReading]


class WaterLevelHistory(BaseModel):
    data_source: DataSourceInfo
    history: List[WaterLevelReading]
