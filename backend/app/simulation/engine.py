import math
from random import Random
from datetime import datetime, timedelta
from typing import Dict, Any, List


class SyntheticEngine:
    def __init__(self, lat: float, lon: float):
        self.lat = lat
        self.lon = lon
        # Seed based on location for deterministic "character"
        self.seed = int((abs(lat) * 1000 + abs(lon) * 1000)) % (2**31)
        self.rng = Random(self.seed)

        # Location-specific baselines
        self.baseline_water_level = round(3.5 + (self.rng.random() * 2.0), 2)
        self.baseline_ph = round(6.9 + (self.rng.random() * 0.8), 2)
        self.baseline_tds = round(220 + (self.rng.random() * 260), 1)
        self.baseline_turbidity = round(5.0 + (self.rng.random() * 10.0), 1)

        # Periodic parameters
        self.ph_phase_offset = self.rng.random() * 2 * math.pi
        self.water_level_daily_variation = round(0.18 + (self.rng.random() * 0.25), 2)
        self.min_temp = round(20.0 + (self.rng.random() * 6.0), 1)
        self.max_temp = round(self.min_temp + 8.0 + (self.rng.random() * 6.0), 1)
        self.aqi_baseline = round(45.0 + (self.rng.random() * 55.0), 1)

    def get_water_level(self, timestamp: datetime, recent_rainfall: float = 0.0) -> float:
        hour = timestamp.hour + timestamp.minute / 60.0
        # Sinusoidal daily fluctuation + rainfall effect
        rainfall_effect = recent_rainfall * 0.12
        level = (
            self.baseline_water_level
            + self.water_level_daily_variation * math.sin(2 * math.pi * hour / 24)
            + rainfall_effect
        )
        return round(max(0.5, level), 2)

    def get_water_quality(self, timestamp: datetime, recent_rainfall: float = 0.0) -> Dict[str, float]:
        hour = timestamp.hour + timestamp.minute / 60.0

        # pH: baseline +- 0.15 * sin(2pi*hour/24 + offset) + micro-noise
        noise = (self.rng.random() - 0.5) * 0.04
        ph = self.baseline_ph + 0.14 * math.sin(2 * math.pi * hour / 24 + self.ph_phase_offset) + noise

        # Turbidity increases with rainfall/runoff
        turbidity = self.baseline_turbidity + (recent_rainfall * 2.2) + (self.rng.random() * 1.5)

        # TDS fluctuates slightly, dilutes with high rainfall
        tds = self.baseline_tds + (self.rng.random() * 12.0) - (recent_rainfall * 3.5)

        # Water temperature (gradual daily sinusoidal with 2-hour thermal lag behind air temp)
        temp_wave = 0.5 + 0.5 * math.sin(2 * math.pi * (hour - 8) / 24)
        water_temp = self.min_temp + (self.max_temp - self.min_temp) * 0.85 * temp_wave

        # Dissolved Oxygen inversely proportional to temperature + aeration
        dissolved_oxygen = 8.8 - (water_temp * 0.12) + (self.rng.random() * 0.4)

        return {
            "ph": round(max(5.5, min(9.5, ph)), 2),
            "turbidity": round(max(0.8, turbidity), 1),
            "tds": round(max(50.0, tds), 1),
            "temperature": round(water_temp, 1),
            "dissolved_oxygen": round(max(1.5, dissolved_oxygen), 1),
        }

    def get_air_quality(self, timestamp: datetime, wind_speed: float = 0.0) -> Dict[str, Any]:
        hour = timestamp.hour + timestamp.minute / 60.0
        # Traffic peaks around 9am and 6pm
        traffic_factor = math.exp(-0.5 * ((hour - 9) / 2.0)**2) + math.exp(-0.5 * ((hour - 18) / 2.0)**2)
        wind_dispersion = max(0.3, 1.0 - (wind_speed * 0.04))

        base_aqi = self.aqi_baseline * wind_dispersion
        current_aqi = base_aqi + (traffic_factor * 28.0) + (self.rng.random() * 8.0)

        pm25 = current_aqi * 0.38
        pm10 = current_aqi * 0.65
        no2 = current_aqi * 0.18
        so2 = current_aqi * 0.08
        o3 = max(10.0, 35.0 * math.sin(math.pi * max(0.0, hour - 6) / 12) + (self.rng.random() * 5.0))
        co = round(max(0.2, current_aqi * 0.008), 2)

        def get_category(aqi_val: float) -> str:
            if aqi_val <= 50:
                return "Good"
            if aqi_val <= 100:
                return "Moderate"
            if aqi_val <= 150:
                return "Unhealthy for Sensitive Groups"
            if aqi_val <= 200:
                return "Unhealthy"
            if aqi_val <= 300:
                return "Very Unhealthy"
            return "Hazardous"

        return {
            "aqi": round(current_aqi, 1),
            "pm25": round(pm25, 1),
            "pm10": round(pm10, 1),
            "no2": round(no2, 1),
            "so2": round(so2, 1),
            "o3": round(o3, 1),
            "co": co,
            "category": get_category(current_aqi),
        }

    def get_weather(self, timestamp: datetime) -> Dict[str, Any]:
        hour = timestamp.hour + timestamp.minute / 60.0
        # Daily temperature sinusoidal (peaks ~14:00)
        temp_cycle = 0.5 + 0.5 * math.sin(2 * math.pi * (hour - 8) / 24)
        temp = self.min_temp + (self.max_temp - self.min_temp) * temp_cycle

        # Relative humidity inversely correlates with temperature
        rel_humidity = 88.0 - (temp_cycle * 38.0) + ((self.rng.random() - 0.5) * 6.0)
        rel_humidity = max(30.0, min(98.0, rel_humidity))

        # Apparent temp / Heat Index approximation
        apparent_temp = temp + (0.33 * (rel_humidity / 100.0) * 6.105 * math.exp(17.27 * temp / (237.7 + temp))) - 0.7

        # Deterministic periodic precipitation
        rain_prob = math.sin(2 * math.pi * hour / 12 + self.lat)
        precip = round(max(0.0, rain_prob * 3.5), 1) if rain_prob > 0.4 else 0.0

        wind_speed = round(8.0 + 8.0 * math.sin(2 * math.pi * hour / 24) + (self.rng.random() * 4.0), 1)
        wind_dir = round((self.lon * 10 + hour * 15) % 360, 0)
        wind_gusts = round(wind_speed * (1.3 + self.rng.random() * 0.4), 1)

        cloud_cover = round(min(100.0, max(10.0, (rel_humidity * 0.8) + (precip * 15.0))), 0)

        # UV index: 0 at night, peak ~6-10 at solar noon
        if 6 <= hour <= 18:
            uv = round(max(0.0, 9.5 * math.sin(math.pi * (hour - 6) / 12) * (1.0 - cloud_cover / 150.0)), 1)
        else:
            uv = 0.0

        pressure = round(1013.2 + 2.5 * math.cos(2 * math.pi * hour / 12) - (self.lat * 0.05), 1)
        visibility = round(max(2000.0, 10000.0 - (cloud_cover * 40.0) - (precip * 500.0)), 0)

        # WMO weather code: 0=clear, 1-3=partly cloudy/overcast, 51-65=rain, 80=showers
        if precip > 5.0:
            weather_code = 65  # Heavy rain
        elif precip > 1.5:
            weather_code = 61  # Slight/moderate rain
        elif precip > 0.0:
            weather_code = 51  # Light drizzle
        elif cloud_cover > 75:
            weather_code = 3   # Overcast
        elif cloud_cover > 35:
            weather_code = 2   # Partly cloudy
        else:
            weather_code = 0   # Clear sky

        return {
            "temperature_2m": round(temp, 1),
            "relative_humidity_2m": round(rel_humidity, 1),
            "apparent_temperature": round(apparent_temp, 1),
            "precipitation": precip,
            "rain": precip,
            "weather_code": weather_code,
            "surface_pressure": pressure,
            "wind_speed_10m": wind_speed,
            "wind_direction_10m": wind_dir,
            "wind_gusts_10m": wind_gusts,
            "cloud_cover": cloud_cover,
            "uv_index": uv,
            "visibility": visibility,
        }

    def generate_weather_forecast_response(self, hours: int = 48) -> Dict[str, Any]:
        """Generate structured forecast mirroring OpenMeteo payload format."""
        now = datetime.utcnow()
        times = []
        temps = []
        humidity = []
        precip = []
        wind = []
        uv = []

        for i in range(hours):
            t = now + timedelta(hours=i)
            w = self.get_weather(t)
            times.append(t.strftime("%Y-%m-%dT%H:00"))
            temps.append(w["temperature_2m"])
            humidity.append(w["relative_humidity_2m"])
            precip.append(w["precipitation"])
            wind.append(w["wind_speed_10m"])
            uv.append(w["uv_index"])

        daily_weather_codes = []
        daily_max_temp = []
        daily_min_temp = []
        daily_precip = []

        for d in range(7):
            d_date = now + timedelta(days=d)
            daily_weather_codes.append(self.get_weather(d_date.replace(hour=14))["weather_code"])
            daily_max_temp.append(self.max_temp)
            daily_min_temp.append(self.min_temp)
            daily_precip.append(round(max(0.0, math.sin(d + self.lat) * 6.0), 1))

        return {
            "current": self.get_weather(now),
            "hourly": {
                "time": times,
                "temperature_2m": temps,
                "relative_humidity_2m": humidity,
                "precipitation": precip,
                "wind_speed_10m": wind,
                "uv_index": uv,
            },
            "daily": {
                "weather_code": daily_weather_codes,
                "temperature_2m_max": daily_max_temp,
                "temperature_2m_min": daily_min_temp,
                "precipitation_sum": daily_precip,
            },
        }
