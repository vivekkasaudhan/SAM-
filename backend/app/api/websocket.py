import asyncio
import json
from typing import Dict, Any, Set
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.environment_service import EnvironmentService

router = APIRouter()
env_service = EnvironmentService()


class TelemetryConnectionManager:
    def __init__(self):
        self.active_sockets: Set[WebSocket] = set()
        self.socket_locations: Dict[WebSocket, Dict[str, float]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_sockets.add(websocket)
        # Default subscription: Jamshedpur
        self.socket_locations[websocket] = {"lat": 22.8046, "lon": 86.2029}

    def set_location(self, websocket: WebSocket, lat: float, lon: float):
        if websocket in self.active_sockets:
            self.socket_locations[websocket] = {"lat": lat, "lon": lon}

    def disconnect(self, websocket: WebSocket):
        self.active_sockets.discard(websocket)
        self.socket_locations.pop(websocket, None)

    async def send_telemetry(self, websocket: WebSocket):
        loc = self.socket_locations.get(websocket, {"lat": 22.8046, "lon": 86.2029})
        lat, lon = loc["lat"], loc["lon"]

        try:
            wl = env_service.get_water_level(lat, lon)
            wq = env_service.get_water_quality(lat, lon)
            aq = env_service.get_air_quality(lat, lon)

            update = {
                "type": "TELEMETRY_STREAM",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "location": {"lat": lat, "lon": lon},
                "water_level": {
                    "water_level": wl.water_level,
                    "trend": wl.trend,
                    "change_1h_m": wl.change_1h_m,
                    "flow_rate_cumecs": wl.flow_rate_cumecs,
                    "status": wl.status,
                    "data_source": wl.data_source.model_dump(),
                },
                "water_quality": {
                    "ph": wq.ph,
                    "turbidity": wq.turbidity,
                    "tds": wq.tds,
                    "temperature": wq.temperature,
                    "dissolved_oxygen": wq.dissolved_oxygen,
                    "category": wq.category,
                    "data_source": wq.data_source.model_dump(),
                },
                "air_quality": {
                    "aqi": aq.aqi,
                    "pm25": aq.pm25,
                    "pm10": aq.pm10,
                    "category": aq.category,
                    "data_source": aq.data_source.model_dump(),
                },
            }
            await websocket.send_text(json.dumps(update))
        except Exception:
            pass


manager = TelemetryConnectionManager()


@router.websocket("/ws/updates")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    async def sender_loop():
        try:
            while True:
                await manager.send_telemetry(websocket)
                await asyncio.sleep(6)  # Telemetry pulse every 6 seconds
        except asyncio.CancelledError:
            pass
        except Exception:
            pass

    sender_task = asyncio.create_task(sender_loop())

    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
                if msg.get("action") == "subscribe" and "lat" in msg and "lon" in msg:
                    manager.set_location(websocket, float(msg["lat"]), float(msg["lon"]))
                    # Push immediate telemetry for new location
                    await manager.send_telemetry(websocket)
            except Exception:
                pass
    except WebSocketDisconnect:
        sender_task.cancel()
        manager.disconnect(websocket)
    except Exception:
        sender_task.cancel()
        manager.disconnect(websocket)
