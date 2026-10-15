from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

from app.api import (
    environment,
    weather,
    water,
    air_quality,
    risk,
    location,
    stations,
    websocket,
    forecast,
    history,
    analytics,
    wells,
    auth,
    sensors,
    geo,
    lithology,
    scheduler,
    alerts,
)
from app.models.database import init_db
from app.seed import seed_demo_wells
from app.services.scheduler_service import simulation_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    try:
        init_db()
        # Seed development demo wells if development mode (idempotent, won't duplicate)
        if (settings.environment or "development").lower() == "development":
            seed_demo_wells()
        # Start background simulation scheduler
        if settings.simulation_enabled:
            await simulation_scheduler.start()
    except Exception as e:
        print("DB init warning:", e)

    yield

    # Clean shutdown of background scheduler
    try:
        if simulation_scheduler.is_running:
            await simulation_scheduler.stop()
    except Exception as e:
        print("Scheduler shutdown warning:", e)


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api", tags=["Auth"])
app.include_router(geo.router, prefix="/api", tags=["Geographic Hierarchy"])
app.include_router(sensors.router, prefix="/api", tags=["Sensors & IoT Ingestion"])
app.include_router(scheduler.router, prefix="/api", tags=["Background Simulation Scheduler"])
app.include_router(environment.router, prefix="/api", tags=["Environment"])
app.include_router(weather.router, prefix="/api", tags=["Weather"])
app.include_router(water.router, prefix="/api", tags=["Water"])
app.include_router(wells.router, prefix="/api", tags=["Wells"])
app.include_router(lithology.router, prefix="/api", tags=["Lithology & Stratigraphy"])
app.include_router(alerts.router, prefix="/api", tags=["Early-Warning & Risk Alerts"])
app.include_router(air_quality.router, prefix="/api", tags=["Air Quality"])
app.include_router(risk.router, prefix="/api", tags=["Risk"])
app.include_router(location.router, prefix="/api", tags=["Location"])
app.include_router(stations.router, prefix="/api", tags=["Stations"])
app.include_router(forecast.router, prefix="/api", tags=["Forecast"])
app.include_router(history.router, prefix="/api", tags=["History"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])
app.include_router(websocket.router, tags=["WebSocket"])


@app.get("/")
async def root():
    return {
        "message": "Welcome to AquaSense – Environmental Intelligence Platform API",
        "status": "online",
        "version": "1.0.0",
    }
