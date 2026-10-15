from enum import Enum
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from .base import DataSourceInfo

class RiskLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class RiskFactor(BaseModel):
    category: str
    level: RiskLevel
    score: float
    description: str

class RiskAssessment(BaseModel):
    timestamp: datetime
    data_source: DataSourceInfo
    overall_level: RiskLevel
    overall_score: float
    factors: List[RiskFactor]
