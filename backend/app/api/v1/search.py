import math
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.core.database import get_db
from app.models.entities import Load, Vehicle, LoadStatus

router = APIRouter(prefix="/search", tags=["Smart Search & Matching Engine"])

def calculate_match_score(load: Load, vehicle: Vehicle) -> dict:
    score = 0
    reasons = []

    # 1. Location match
    if vehicle.current_country.lower() == load.origin_country.lower():
        score += 30
        reasons.append(f"Joylashuv mos: Ikkalasi ham {load.origin_country}da")
        if vehicle.current_city.lower() == load.origin_city.lower():
            score += 20
            reasons.append(f"Shahar mos: Mashina aynan {load.origin_city}da joylashgan")
    
    # 2. Destination match
    if vehicle.preferred_destinations and load.destination_country.lower() in vehicle.preferred_destinations.lower():
        score += 20
        reasons.append(f"Yo'nalish mos: Haydovchi {load.destination_country}ga qatnaydi")

    # 3. Capacity & Volume
    load_weight_tons = load.weight_kg / 1000.0
    if vehicle.max_weight_tons >= load_weight_tons:
        score += 15
        reasons.append(f"Og'irlik mos: Mashina sig'imi {vehicle.max_weight_tons}t >= Yuk {load_weight_tons:.1f}t")
    else:
        return {"score": 0, "reasons": ["Mashina yuk ko'tara olmaydi (vazn ortiqcha)"], "is_compatible": False}

    if vehicle.max_volume_m3 >= load.volume_m3:
        score += 10
        reasons.append(f"Hajm mos: Mashina hajmi {vehicle.max_volume_m3}m³ >= Yuk {load.volume_m3}m³")
    
    # 4. Temperature & ADR
    if load.requires_temperature:
        if vehicle.has_temperature_control:
            score += 5
            reasons.append("Harorat nazorati (Refrijerator) mavjud")
        else:
            return {"score": 0, "reasons": ["Yuk muzlatgich/refrijerator talab qiladi"], "is_compatible": False}

    if load.is_adr:
        if vehicle.has_adr:
            score += 5
            reasons.append("Xavfli yuk (ADR) ruxsatnomasi mavjud")
        else:
            return {"score": 0, "reasons": ["Xavfli yuk (ADR) talab qilinadi"], "is_compatible": False}

    return {
        "score": min(100, score),
        "reasons": reasons,
        "is_compatible": score >= 50
    }

@router.get("/match-for-vehicle/{vehicle_id}")
async def match_loads_for_vehicle(vehicle_id: str, db: AsyncSession = Depends(get_db)):
    stmt_v = select(Vehicle).where(Vehicle.id == vehicle_id)
    res_v = await db.execute(stmt_v)
    vehicle = res_v.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    stmt_l = select(Load).where(
        Load.status.in_([LoadStatus.ACTIVE.value, LoadStatus.NEGOTIATION.value, "PUBLISHED", "OFFERS_RECEIVED"]),
        Load.is_paused == False
    )
    res_l = await db.execute(stmt_l)
    loads = res_l.scalars().all()

    matches = []
    for l in loads:
        match_info = calculate_match_score(l, vehicle)
        if match_info["is_compatible"]:
            matches.append({
                "load_id": l.id,
                "cargo_title": l.cargo_title,
                "origin": f"{l.origin_city}, {l.origin_country}",
                "destination": f"{l.destination_city}, {l.destination_country}",
                "price": f"{l.price} {l.currency}",
                "loading_date": l.loading_date.isoformat(),
                "weight_kg": l.weight_kg,
                "volume_m3": l.volume_m3,
                "relevance_score": match_info["score"],
                "reasons": match_info["reasons"]
            })

    matches.sort(key=lambda x: x["relevance_score"], reverse=True)
    return matches
