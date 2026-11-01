from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import asyncio
import logging

from app.core.config import settings
from app.core.seed import seed_initial_data
from app.api.v1 import (
    auth, loads, vehicles, offers, search, subscriptions, chat, admin, notifications, dashboard
)

logger = logging.getLogger(__name__)

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
        "nakrutka_bot": "running 24/7"
    }

async def run_nakrutka_bot():
    try:
        from nakrutka_service.bot import bot, dp, main as bot_main
        logger.info("Starting 24/7 Nakrutka Telegram Bot in background...")
        await bot_main()
    except Exception as e:
        logger.error(f"Error in 24/7 Nakrutka Bot: {e}")

@app.on_event("startup")
async def on_startup():
    await seed_initial_data()
    # Launch Nakrutka Bot 24/7 in background
    asyncio.create_task(run_nakrutka_bot())

@app.get("/health")
async def health_check():
    db_scheme = settings.DATABASE_URL.split("://")[0] if "://" in settings.DATABASE_URL else "unknown"
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "database_backend": db_scheme,
        "nakrutka_bot": "active"
    }
