from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.entities import (
    Load, User, Company, UserRole, LoadStatus, Subscription, SubscriptionStatus, OrderStatusHistory
)
from app.schemas.dto import LoadCreateRequest, LoadResponse

router = APIRouter(prefix="/loads", tags=["Freight Load Marketplace"])

@router.get("/")
async def list_loads(
    origin_country: Optional[str] = None,
    origin_city: Optional[str] = None,
    destination_country: Optional[str] = None,
    destination_city: Optional[str] = None,
    vehicle_type: Optional[str] = None,
    min_weight: Optional[float] = None,
    max_weight: Optional[float] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    Search and filter cargo. 100% FREE and accessible to all drivers and users.
    """
    stmt = select(Load).options(selectinload(Load.company)).where(
        Load.status.in_([LoadStatus.ACTIVE.value, LoadStatus.NEGOTIATION.value, "PUBLISHED", "OFFERS_RECEIVED"]),
        Load.is_paused == False
    ).order_by(Load.created_at.desc())

    if origin_country:
        stmt = stmt.where(Load.origin_country.ilike(f"%{origin_country}%"))
    if origin_city:
        stmt = stmt.where(Load.origin_city.ilike(f"%{origin_city}%"))
    if destination_country:
        stmt = stmt.where(Load.destination_country.ilike(f"%{destination_country}%"))
    if destination_city:
        stmt = stmt.where(Load.destination_city.ilike(f"%{destination_city}%"))
    if vehicle_type:
        stmt = stmt.where(Load.required_vehicle_type.ilike(f"%{vehicle_type}%"))
    if min_weight:
        stmt = stmt.where(Load.weight_kg >= min_weight)
    if max_weight:
        stmt = stmt.where(Load.weight_kg <= max_weight)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    loads = result.scalars().all()

    output = []
    for l in loads:
        output.append({
            "id": l.id,
            "origin_country": l.origin_country,
            "origin_city": l.origin_city,
            "destination_country": l.destination_country,
            "destination_city": l.destination_city,
            "loading_date": l.loading_date.isoformat(),
            "cargo_title": l.cargo_title,
            "cargo_category": l.cargo_category,
            "weight_kg": l.weight_kg,
            "volume_m3": l.volume_m3,
            "required_vehicle_type": l.required_vehicle_type,
            "requires_temperature": l.requires_temperature,
            "is_adr": l.is_adr,
            "price": l.price,
            "currency": l.currency,
            "is_negotiable": l.is_negotiable,
            "contact_name": l.contact_name,
            "contact_phone": l.contact_phone,
            "description": l.description,
            "status": l.status,
            "is_paused": l.is_paused,
            "created_at": l.created_at.isoformat(),
            "company_name": l.company.name if l.company else None
        })
    return output

@router.post("/", response_model=dict)
async def create_load(
    req: LoadCreateRequest,
    current_user: User = Depends(require_roles([
        UserRole.LOGISTIC.value,
        UserRole.LOGISTICS_COMPANY_OWNER.value,
        UserRole.TRANSPORT_COMPANY.value,
        UserRole.SUPER_ADMIN.value
    ])),
    db: AsyncSession = Depends(get_db)
):
    company_id = None
    if current_user.role == UserRole.LOGISTICS_COMPANY_OWNER.value:
        stmt_comp = select(Company).where(Company.owner_id == current_user.id)
        res_comp = await db.execute(stmt_comp)
        company = res_comp.scalar_one_or_none()
        if company:
            company_id = company.id

    new_load = Load(
        company_id=company_id,
        created_by=current_user.id,
        origin_country=req.origin_country,
        origin_city=req.origin_city,
        origin_address=req.origin_address,
        origin_lat=req.origin_lat,
        origin_lon=req.origin_lon,
        destination_country=req.destination_country,
        destination_city=req.destination_city,
        destination_address=req.destination_address,
        destination_lat=req.destination_lat,
        destination_lon=req.destination_lon,
        loading_date=req.loading_date,
        delivery_deadline=req.delivery_deadline,
        cargo_title=req.cargo_title,
        cargo_category=req.cargo_category,
        weight_kg=req.weight_kg,
        volume_m3=req.volume_m3,
        pallets_count=req.pallets_count or 0,
        required_vehicle_type=req.required_vehicle_type,
        requires_temperature=req.requires_temperature,
        temp_min=req.temp_min,
        temp_max=req.temp_max,
        is_adr=req.is_adr,
        adr_class=req.adr_class,
        price=req.price,
        currency=req.currency,
        is_negotiable=req.is_negotiable,
        contact_phone=req.contact_phone,
        contact_name=req.contact_name,
        description=req.description,
        status=LoadStatus.ACTIVE.value
    )
    db.add(new_load)
    await db.flush()

    # Log initial status in history
    history = OrderStatusHistory(
        load_id=new_load.id,
        from_status=None,
        to_status=LoadStatus.ACTIVE.value,
        changed_by_user_id=current_user.id,
        comment="Cargo initially published"
    )
    db.add(history)

    await db.commit()
    await db.refresh(new_load)

    return {"success": True, "message": "Cargo published successfully", "load_id": new_load.id}

@router.get("/{load_id}")
async def get_load_detail(load_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Load).options(
        selectinload(Load.company), 
        selectinload(Load.creator),
        selectinload(Load.history_logs)
    ).where(Load.id == load_id)
    res = await db.execute(stmt)
    l = res.scalar_one_or_none()
    if not l:
        raise HTTPException(status_code=404, detail="Cargo not found")

    l.views_count += 1
    await db.commit()

    return {
        "id": l.id,
        "company_id": l.company_id,
        "created_by": l.created_by,
        "origin_country": l.origin_country,
        "origin_city": l.origin_city,
        "origin_address": l.origin_address,
        "destination_country": l.destination_country,
        "destination_city": l.destination_city,
        "destination_address": l.destination_address,
        "loading_date": l.loading_date.isoformat(),
        "delivery_deadline": l.delivery_deadline.isoformat() if l.delivery_deadline else None,
        "cargo_title": l.cargo_title,
        "cargo_category": l.cargo_category,
        "weight_kg": l.weight_kg,
        "volume_m3": l.volume_m3,
        "pallets_count": l.pallets_count,
        "required_vehicle_type": l.required_vehicle_type,
        "requires_temperature": l.requires_temperature,
        "is_adr": l.is_adr,
        "price": l.price,
        "currency": l.currency,
        "is_negotiable": l.is_negotiable,
        "contact_name": l.contact_name,
        "contact_phone": l.contact_phone,
        "description": l.description,
        "status": l.status,
        "is_paused": l.is_paused,
        "views_count": l.views_count,
        "created_at": l.created_at.isoformat(),
        "company_name": l.company.name if l.company else None,
        "history": [{
            "id": h.id,
            "from_status": h.from_status,
            "to_status": h.to_status,
            "comment": h.comment,
            "timestamp": h.created_at.isoformat()
        } for h in (l.history_logs or [])]
    }
