import math
import httpx
from typing import Dict, Any, Optional, List
from app.schemas.location import LocationInfo
from app.models.stations import get_demo_stations

KNOWN_LOCATIONS = [
    {
        "name": "Jamshedpur",
        "state": "Jharkhand",
        "country": "India",
        "lat": 22.8046,
        "lon": 86.2029,
        "river": "Subarnarekha River",
        "display_name": "Jamshedpur, East Singhbhum, Jharkhand, India",
    },
    {
        "name": "Subarnarekha River",
        "state": "Jharkhand",
        "country": "India",
        "lat": 22.8120,
        "lon": 86.2100,
        "river": "Subarnarekha River",
        "display_name": "Subarnarekha River Basin, Jamshedpur, Jharkhand",
    },
    {
        "name": "Ranchi",
        "state": "Jharkhand",
        "country": "India",
        "lat": 23.3441,
        "lon": 85.3096,
        "river": "Subarnarekha River",
        "display_name": "Ranchi, Jharkhand, India",
    },
    {
        "name": "Kolkata",
        "state": "West Bengal",
        "country": "India",
        "lat": 22.5726,
        "lon": 88.3639,
        "river": "Hooghly River",
        "display_name": "Kolkata, West Bengal, India",
    },
    {
        "name": "Delhi",
        "state": "Delhi",
        "country": "India",
        "lat": 28.6139,
        "lon": 77.2090,
        "river": "Yamuna River",
        "display_name": "New Delhi, Delhi, India",
    },
    {
        "name": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "lat": 19.0760,
        "lon": 72.8777,
        "river": "Mithi River / Arabian Sea",
        "display_name": "Mumbai, Maharashtra, India",
    },
    {
        "name": "Bengaluru",
        "state": "Karnataka",
        "country": "India",
        "lat": 12.9716,
        "lon": 77.5946,
        "river": "Vrishabhavathi Basin",
        "display_name": "Bengaluru, Karnataka, India",
    },
    {
        "name": "Bhubaneswar",
        "state": "Odisha",
        "country": "India",
        "lat": 20.2961,
        "lon": 85.8245,
        "river": "Mahanadi Basin",
        "display_name": "Bhubaneswar, Odisha, India",
    },
    {
        "name": "Patna",
        "state": "Bihar",
        "country": "India",
        "lat": 25.5941,
        "lon": 85.1376,
        "river": "Ganga River",
        "display_name": "Patna, Bihar, India",
    },
]


class LocationService:
    def __init__(self):
        self._cache: Dict[str, LocationInfo] = {}

    def _distance_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    async def reverse_geocode(self, lat: float, lon: float) -> LocationInfo:
        cache_key = f"{lat:.4f},{lon:.4f}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # 1. Check verified local bounding boxes and geographic reference resolution
        from app.services.geo_service import GeoService
        geo_service = GeoService()
        resolved = geo_service.resolve_hierarchy_by_coordinates(lat, lon)
        if resolved.get("city") and resolved.get("state"):
            dist_label = f", {resolved['district']}" if resolved.get("district") else ""
            res = LocationInfo(
                lat=lat,
                lon=lon,
                display_name=f"{resolved['city']}{dist_label}, {resolved['state']}, {resolved['country']}",
                city=resolved["city"],
                district=resolved.get("district"),
                state=resolved["state"],
                country=resolved["country"],
            )
            self._cache[cache_key] = res
            return res

        # 2. Check known landmarks within 20km
        for loc in KNOWN_LOCATIONS:
            if self._distance_km(lat, lon, loc["lat"], loc["lon"]) <= 20.0:
                dist = self._distance_km(lat, lon, loc["lat"], loc["lon"])
                if dist < 3.0:
                    display = loc["display_name"]
                else:
                    display = f"{loc['name']} Region ({dist:.1f} km from center), {loc['state']}"
                res = LocationInfo(
                    lat=lat,
                    lon=lon,
                    display_name=display,
                    city=loc["name"],
                    district="East Singhbhum" if loc["name"] == "Jamshedpur" else None,
                    state=loc["state"],
                    country=loc["country"],
                )
                self._cache[cache_key] = res
                return res

        # 3. Attempt online Nominatim lookup with 1.5s timeout (cached to respect policy)
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json"
        headers = {"User-Agent": "AquaSense-Groundwater/1.0 (academic; dev)"}
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    address = data.get("address", {})
                    display_name = data.get("display_name", f"Location at {lat:.4f}, {lon:.4f}")
                    city = address.get("city") or address.get("town") or address.get("village") or address.get("municipality")
                    district = address.get("state_district") or address.get("county") or address.get("district")
                    state = address.get("state")
                    country = address.get("country")
                    res = LocationInfo(
                        lat=lat,
                        lon=lon,
                        display_name=display_name,
                        city=city,
                        district=district,
                        state=state,
                        country=country,
                    )
                    self._cache[cache_key] = res
                    return res
        except Exception:
            pass

        lat_dir = "N" if lat >= 0 else "S"
        lon_dir = "E" if lon >= 0 else "W"
        res = LocationInfo(
            lat=lat,
            lon=lon,
            display_name=f"Location at {abs(lat):.4f}° {lat_dir}, {abs(lon):.4f}° {lon_dir}",
            city=f"{abs(lat):.2f}°{lat_dir}, {abs(lon):.2f}°{lon_dir}",
            district=None,
            state=None,
            country="India" if (8 <= lat <= 37 and 68 <= lon <= 97) else None,
        )
        self._cache[cache_key] = res
        return res

    async def search_locations(self, query: str) -> List[Dict[str, Any]]:
        query = query.strip()
        if not query:
            return []

        results = []

        # 1. Parse coordinate inputs: "22.8046, 86.2029" or "22.8046 86.2029"
        coord_parts = query.replace(",", " ").split()
        if len(coord_parts) == 2:
            try:
                lat = float(coord_parts[0])
                lon = float(coord_parts[1])
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    info = await self.reverse_geocode(lat, lon)
                    results.append({
                        "name": f"Coordinates ({lat:.4f}, {lon:.4f})",
                        "display_name": info.display_name,
                        "lat": lat,
                        "lon": lon,
                        "type": "COORDINATE",
                    })
                    return results
            except ValueError:
                pass

        # 2. Match known locations and rivers
        q_lower = query.lower()
        for loc in KNOWN_LOCATIONS:
            if (
                q_lower in loc["name"].lower()
                or (loc.get("river") and q_lower in loc["river"].lower())
                or q_lower in loc["state"].lower()
            ):
                results.append({
                    "name": loc["name"],
                    "display_name": loc["display_name"],
                    "lat": loc["lat"],
                    "lon": loc["lon"],
                    "type": "RIVER" if "river" in loc["name"].lower() else "CITY",
                })

        # 3. Match registered database wells
        try:
            from app.models.database import SessionLocal, Well
            session = SessionLocal()
            try:
                db_wells = session.query(Well).filter(Well.is_active == True).all()
                for w in db_wells:
                    if q_lower in w.name.lower() or q_lower in w.id.lower() or (w.location_description and q_lower in w.location_description.lower()):
                        results.append({
                            "name": w.name,
                            "display_name": f"{w.name} ({w.location_description or 'Monitoring Well'})",
                            "lat": w.latitude,
                            "lon": w.longitude,
                            "type": "STATION",
                        })
            finally:
                session.close()
        except Exception:
            pass

        # 4. Match demo stations
        for st in get_demo_stations():
            if q_lower in st["name"].lower() or q_lower in st["id"].lower():
                results.append({
                    "name": st["name"],
                    "display_name": f"{st['name']} ({st['type']} Station)",
                    "lat": st["lat"],
                    "lon": st["lon"],
                    "type": "STATION",
                })

        return results[:8]
