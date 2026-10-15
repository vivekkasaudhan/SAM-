from pydantic import BaseModel
from datetime import datetime
from .weather import WeatherReading
from .water import WaterLevelReading, WaterQualityReading
from .air_quality import AirQualityReading
from .risk import RiskAssessment
from .location import LocationInfo


class EnvironmentResponse(BaseModel):
    location: LocationInfo
    weather: WeatherReading
    water_level: WaterLevelReading
    water_quality: WaterQualityReading
    air_quality: AirQualityReading
    risk: RiskAssessment
    timestamp: datetime = None

    def model_post_init(self, __context):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
