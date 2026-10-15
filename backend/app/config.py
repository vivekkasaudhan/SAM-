from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    app_name: str = "AquaSense Environmental Intelligence"
    debug: bool = True
    environment: str = "development"
    port: int = 8000
    host: str = "0.0.0.0"
    cors_origins: str = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
    secret_key: str = "aquasense-development-insecure-key-change-in-production-389148"
    session_expire_hours: int = 24
    initial_admin_username: str = "admin"
    initial_admin_email: str = "admin@aquasense.local"
    initial_admin_password: str = ""  # Set via INITIAL_ADMIN_PASSWORD environment variable
    
    # Background Simulation Engine Scheduler
    simulation_interval_seconds: int = 300  # Default 5 minutes (300 seconds)
    simulation_enabled: bool = True
    
    @property
    def get_cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    class Config:
        env_file = ".env"

settings = Settings()
