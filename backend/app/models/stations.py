from typing import List

DEMO_STATIONS = [
    {
        "id": "ST001",
        "name": "IoT Sensor ST001 (ESP32 Multi-Sensor)",
        "lat": 22.8055,
        "lon": 86.2050,
        "type": "IOT",
        "water_body": "Subarnarekha River",
        "warning_level_m": 5.50,
        "danger_level_m": 6.20,
        "is_active": True,
        "device_model": "ESP32-AquaSense-v2",
        "sensors": ["pH", "TDS", "Turbidity", "Water Temp", "Ultrasonic Water Level"]
    },
    {
        "id": "ST-JAM-01",
        "name": "Jamshedpur Water Monitoring Station",
        "lat": 22.8046,
        "lon": 86.2029,
        "type": "WATER",
        "water_body": "Subarnarekha River",
        "warning_level_m": 5.50,
        "danger_level_m": 6.20,
        "is_active": True
    },
    {
        "id": "ST-RAN-01",
        "name": "Ranchi Swarnarekha Water Station",
        "lat": 23.3441,
        "lon": 85.3096,
        "type": "WATER",
        "water_body": "Subarnarekha River",
        "warning_level_m": 4.80,
        "danger_level_m": 5.80,
        "is_active": True
    },
    {
        "id": "ST-KOL-01",
        "name": "Kolkata Central Air Quality Station",
        "lat": 22.5726,
        "lon": 88.3639,
        "type": "AIR",
        "water_body": "Hooghly Basin",
        "is_active": True
    },
    {
        "id": "ST002",
        "name": "IoT Sensor ST002 (Hooghly River Node)",
        "lat": 22.5780,
        "lon": 88.3580,
        "type": "IOT",
        "water_body": "Hooghly River",
        "warning_level_m": 6.00,
        "danger_level_m": 7.20,
        "is_active": True,
        "device_model": "ESP32-AquaSense-v2"
    },
    {
        "id": "ST-DEL-01",
        "name": "Delhi Central Air Quality Station",
        "lat": 28.6139,
        "lon": 77.2090,
        "type": "AIR",
        "water_body": "Yamuna River",
        "is_active": True
    },
    {
        "id": "ST-MUM-01",
        "name": "Mumbai Coastal Monitoring Station",
        "lat": 19.0760,
        "lon": 72.8777,
        "type": "WATER",
        "water_body": "Mithi River / Arabian Sea",
        "warning_level_m": 3.80,
        "danger_level_m": 4.50,
        "is_active": True
    },
    {
        "id": "ST-BEN-01",
        "name": "Bengaluru Water Quality Station",
        "lat": 12.9716,
        "lon": 77.5946,
        "type": "WATER",
        "water_body": "Bellandur Catchment",
        "warning_level_m": 4.20,
        "danger_level_m": 5.00,
        "is_active": True
    },
    {
        "id": "ST-BHU-01",
        "name": "Bhubaneswar Flood & Weather Station",
        "lat": 20.2961,
        "lon": 85.8245,
        "type": "IOT",
        "water_body": "Mahanadi Basin",
        "warning_level_m": 7.00,
        "danger_level_m": 8.50,
        "is_active": True
    },
    {
        "id": "ST-PAT-01",
        "name": "Patna Ganga Flood Monitoring Station",
        "lat": 25.5941,
        "lon": 85.1376,
        "type": "WATER",
        "water_body": "Ganga River",
        "warning_level_m": 49.50,
        "danger_level_m": 50.50,
        "is_active": True
    }
]

def get_demo_stations() -> List[dict]:
    return DEMO_STATIONS
