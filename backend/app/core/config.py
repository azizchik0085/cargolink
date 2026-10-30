import os
from pydantic import BaseModel
from typing import List

class Settings(BaseModel):
    PROJECT_NAME: str = "CARGOLINK"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "cargolink-ultra-secure-secret-key-3289547289")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Database connection URL
    _raw_db_url: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./cargolink.db")
    
    @property
    def DATABASE_URL(self) -> str:
        # Convert postgres:// or postgresql:// to postgresql+asyncpg:// for async SQLAlchemy
        url = self._raw_db_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    SYNC_DATABASE_URL: str = os.getenv("SYNC_DATABASE_URL", "sqlite:///./cargolink.db")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*"
    ]
    
    # Storage
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    
    # Business Limits & Subscription Rules
    FREE_DRIVER_ACCESS: bool = True
    TRANSACTION_COMMISSION_PERCENT: float = 0.0  # STRICTLY 0%

settings = Settings()
