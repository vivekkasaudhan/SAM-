from typing import List, Dict, Any
from datetime import datetime
from app.schemas.risk import RiskAssessment, RiskFactor, RiskLevel
from app.schemas.base import DataSourceInfo, DataStatus, DataSource


class RiskService:
    def calculate_risk(
        self,
        water_level: float,
        warning_level: float,
        danger_level: float,
        water_quality: Dict[str, Any],
        air_quality: Dict[str, Any],
        weather: Dict[str, Any],
    ) -> RiskAssessment:
        factors: List[RiskFactor] = []
        overall_score = 0.0

        # ─── 1. Flood Risk ────────────────────────────────────────────────────
        rainfall = weather.get("precipitation", 0.0)
        level_pct = water_level / danger_level if danger_level > 0 else 0.0

        flood_desc_parts = []
        if water_level >= danger_level:
            flood_score = 95.0
            flood_level = RiskLevel.CRITICAL
            flood_desc_parts.append("Water level has exceeded danger threshold")
        elif water_level >= warning_level:
            flood_score = 70.0
            flood_level = RiskLevel.HIGH
            flood_desc_parts.append("Water level is above warning threshold")
        elif level_pct > 0.75:
            flood_score = 45.0
            flood_level = RiskLevel.MODERATE
            flood_desc_parts.append("Water level approaching warning threshold")
        else:
            flood_score = 10.0
            flood_level = RiskLevel.LOW
            flood_desc_parts.append("Water level within safe range")

        if rainfall > 20.0:
            flood_score = min(100, flood_score + 20)
            if flood_level == RiskLevel.LOW:
                flood_level = RiskLevel.MODERATE
            flood_desc_parts.append(f"Heavy rainfall recorded ({rainfall:.1f} mm)")
        elif rainfall > 10.0:
            flood_score = min(100, flood_score + 10)
            flood_desc_parts.append(f"Moderate rainfall ({rainfall:.1f} mm)")

        factors.append(RiskFactor(
            category="FLOOD",
            level=flood_level,
            score=flood_score,
            description=". ".join(flood_desc_parts),
        ))

        # ─── 2. Water Quality Risk ────────────────────────────────────────────
        ph = water_quality.get("ph", 7.0)
        turbidity = water_quality.get("turbidity", 0.0)
        tds = water_quality.get("tds", 0.0)
        do_ = water_quality.get("dissolved_oxygen", 8.0)

        wq_desc_parts = []
        wq_score = 0.0
        if ph < 5.5 or ph > 9.5 or turbidity > 100 or tds > 1200:
            wq_score = 92.0
            wq_level = RiskLevel.CRITICAL
            wq_desc_parts.append("Critical water quality degradation")
        elif ph < 6.0 or ph > 9.0 or turbidity > 50 or tds > 800:
            wq_score = 72.0
            wq_level = RiskLevel.HIGH
            wq_desc_parts.append("Poor water quality detected")
        elif ph < 6.5 or ph > 8.5 or turbidity > 20 or tds > 500:
            wq_score = 42.0
            wq_level = RiskLevel.MODERATE
            wq_desc_parts.append("Moderate water quality concern")
        else:
            wq_score = 10.0
            wq_level = RiskLevel.LOW
            wq_desc_parts.append("Water quality within acceptable limits")

        if ph < 6.5:
            wq_desc_parts.append(f"pH is acidic ({ph:.2f})")
        elif ph > 8.5:
            wq_desc_parts.append(f"pH is alkaline ({ph:.2f})")
        if turbidity > 10:
            wq_desc_parts.append(f"Elevated turbidity ({turbidity:.1f} NTU)")
        if do_ < 5.0:
            wq_desc_parts.append(f"Low dissolved oxygen ({do_:.1f} mg/L)")

        factors.append(RiskFactor(
            category="WATER_QUALITY",
            level=wq_level,
            score=wq_score,
            description=". ".join(wq_desc_parts),
        ))

        # ─── 3. Air Quality Risk ──────────────────────────────────────────────
        aqi = air_quality.get("aqi", 0.0)
        pm25 = air_quality.get("pm25", 0.0)

        aq_desc_parts = []
        if aqi > 300:
            aq_score = 95.0
            aq_level = RiskLevel.CRITICAL
            aq_desc_parts.append("Hazardous air quality — avoid outdoor exposure")
        elif aqi > 200:
            aq_score = 80.0
            aq_level = RiskLevel.HIGH
            aq_desc_parts.append("Very unhealthy air quality")
        elif aqi > 100:
            aq_score = 55.0
            aq_level = RiskLevel.MODERATE
            aq_desc_parts.append("Unhealthy for sensitive groups")
        elif aqi > 50:
            aq_score = 30.0
            aq_level = RiskLevel.LOW
            aq_desc_parts.append("Moderate air quality")
        else:
            aq_score = 8.0
            aq_level = RiskLevel.LOW
            aq_desc_parts.append("Good air quality")

        if pm25 > 35.0:
            aq_desc_parts.append(f"High PM2.5 concentration ({pm25:.1f} μg/m³)")

        factors.append(RiskFactor(
            category="AIR_QUALITY",
            level=aq_level,
            score=aq_score,
            description=". ".join(aq_desc_parts),
        ))

        # ─── 4. Extreme Weather Risk ─────────────────────────────────────────
        wind_speed = weather.get("wind_speed_10m", 0.0)
        wind_gusts = weather.get("wind_gusts_10m", 0.0)
        ew_desc_parts = []

        if wind_speed > 80 or wind_gusts > 100:
            ew_score = 85.0
            ew_level = RiskLevel.CRITICAL
            ew_desc_parts.append("Severe storm conditions")
        elif wind_speed > 60 or wind_gusts > 80:
            ew_score = 60.0
            ew_level = RiskLevel.HIGH
            ew_desc_parts.append("Strong wind conditions")
        elif wind_speed > 40 or rainfall > 30:
            ew_score = 35.0
            ew_level = RiskLevel.MODERATE
            ew_desc_parts.append("Elevated weather risk")
        else:
            ew_score = 5.0
            ew_level = RiskLevel.LOW
            ew_desc_parts.append("Normal weather conditions")

        factors.append(RiskFactor(
            category="EXTREME_WEATHER",
            level=ew_level,
            score=ew_score,
            description=". ".join(ew_desc_parts),
        ))

        # ─── Overall ─────────────────────────────────────────────────────────
        scores = [f.score for f in factors]
        overall_score = round(max(scores) * 0.6 + sum(scores) / len(scores) * 0.4, 1)

        if overall_score >= 80:
            overall_level = RiskLevel.CRITICAL
        elif overall_score >= 55:
            overall_level = RiskLevel.HIGH
        elif overall_score >= 30:
            overall_level = RiskLevel.MODERATE
        else:
            overall_level = RiskLevel.LOW

        return RiskAssessment(
            timestamp=datetime.utcnow(),
            data_source=DataSourceInfo(
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Risk Engine v1 (Rule-Based)",
            ),
            overall_level=overall_level,
            overall_score=overall_score,
            factors=factors,
        )
