import math
from typing import List
from app.models.stations import get_demo_stations
from app.schemas.location import NearbyStation

class StationService:
    def _haversine(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0 # Earth radius in kilometers
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def get_nearby_stations(self, lat: float, lon: float, radius_km: float = 50.0) -> List[NearbyStation]:
        nearby = []
        try:
            from app.models.database import SessionLocal, Well, Reading
            session = SessionLocal()
            try:
                wells = session.query(Well).filter(Well.is_active == True).all()
                for w in wells:
                    dist = self._haversine(lat, lon, w.latitude, w.longitude)
                    if dist <= radius_km:
                        latest = (
                            session.query(Reading)
                            .filter(Reading.well_id == w.id)
                            .order_by(Reading.timestamp.desc())
                            .first()
                        )
                        reading_summary = None
                        if latest:
                            reading_summary = {
                                "water_level_m": latest.water_level_m,
                                "ph": latest.ph,
                                "tds_ppm": latest.tds_ppm,
                                "turbidity_ntu": latest.turbidity_ntu,
                                "dissolved_oxygen_mg_l": latest.dissolved_oxygen_mg_l,
                                "temperature_c": latest.temperature_c,
                                "status": latest.status,
                                "source": latest.source,
                                "timestamp": latest.timestamp,
                            }
                        nearby.append(NearbyStation(
                            id=w.id,
                            name=w.name,
                            lat=w.latitude,
                            lon=w.longitude,
                            type="WELL",
                            distance_km=round(dist, 2),
                            is_active=w.is_active,
                            latest_reading=reading_summary,
                            warning_level_m=w.warning_level_m,
                            danger_level_m=w.danger_level_m,
                            location_description=w.location_description,
                        ))
            finally:
                session.close()
        except Exception as e:
            print(f"[StationService Warning] Could not fetch wells from DB: {e}")

        # Also include demo stations (WATER, AIR, IOT)
        for st in get_demo_stations():
            dist = self._haversine(lat, lon, st["lat"], st["lon"])
            if dist <= radius_km:
                nearby.append(NearbyStation(
                    id=st["id"],
                    name=st["name"],
                    lat=st["lat"],
                    lon=st["lon"],
                    type=st["type"],
                    distance_km=round(dist, 2),
                    is_active=st["is_active"],
                    warning_level_m=st.get("warning_level_m"),
                    danger_level_m=st.get("danger_level_m"),
                    location_description=st.get("water_body"),
                ))

        return sorted(nearby, key=lambda x: x.distance_km)
