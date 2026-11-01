from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.core.seed import seed_initial_data
from app.api.v1 import (
    auth, loads, vehicles, offers, search, subscriptions, chat, admin, notifications, dashboard
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="International Freight & Vehicle Marketplace Backend API. (Drivers are 100% FREE. Shippers subscribe. 0% Commission.)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(loads.router, prefix=settings.API_V1_STR)
app.include_router(vehicles.router, prefix=settings.API_V1_STR)
app.include_router(offers.router, prefix=settings.API_V1_STR)
app.include_router(search.router, prefix=settings.API_V1_STR)
app.include_router(subscriptions.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "app": "CARGOLINK Freight Marketplace API",
        "status": "online",
        "swagger_docs": "/docs",
        "health": "/health",
        "zero_commission_policy": True,
        "free_driver_access": True
    }

@app.on_event("startup")
async def on_startup():
    await seed_initial_data()

@app.get("/health")
async def health_check():
    db_scheme = settings.DATABASE_URL.split("://")[0] if "://" in settings.DATABASE_URL else "unknown"
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "database_backend": db_scheme,
        "zero_commission_policy": True,
        "free_driver_access": True
    }

from pydantic import BaseModel
class NakrutkaSync(BaseModel):
    user_id: int
    balance: int

nakrutka_db = {8327968713: 23500}

@app.get("/api/v1/nakrutka/balance/{user_id}")
def get_user_balance(user_id: int):
    return {"user_id": user_id, "balance": nakrutka_db.get(user_id, 0)}

@app.post("/api/v1/nakrutka/sync")
def sync_user_balance(data: NakrutkaSync):
    nakrutka_db[data.user_id] = data.balance
    return {"status": "ok", "balance": data.balance}
