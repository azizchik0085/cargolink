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

@app.on_event("startup")
async def on_startup():
    await seed_initial_data()

@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "zero_commission_policy": True,
        "free_driver_access": True
    }
