from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.entities import Vehicle, User, UserRole, VerificationStatus
from app.schemas.dto import VehicleCreateRequest, VehicleResponse

router = APIRouter(prefix="/vehicles", tags=["Vehicle Marketplace (100% FREE for Drivers)"])

@router.get("/")
async def list_vehicles(
    current_country: Optional[str] = None,
    current_city: Optional[str] = None,
    vehicle_type: Optional[str] = None,
    min_capacity_tons: Optional[float] = None,
    has_adr: Optional[bool] = None,
    has_temp: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    Search available trucks. 100% FREE for drivers and vehicle owners to list.
    """
    stmt = select(Vehicle).options(selectinload(Vehicle.owner)).where(
        Vehicle.is_available == True
    ).order_by(Vehicle.created_at.desc())

    if current_country:
        stmt = stmt.where(Vehicle.current_country.ilike(f"%{current_country}%"))
    if current_city:
        stmt = stmt.where(Vehicle.current_city.ilike(f"%{current_city}%"))
    if vehicle_type:
        stmt = stmt.where(Vehicle.vehicle_type.ilike(f"%{vehicle_type}%"))
    if min_capacity_tons:
        stmt = stmt.where(Vehicle.max_weight_tons >= min_capacity_tons)
    if has_adr is not None:
        stmt = stmt.where(Vehicle.has_adr == has_adr)
    if has_temp is not None:
        stmt = stmt.where(Vehicle.has_temperature_control == has_temp)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    vehicles = result.scalars().all()

    output = []
    for v in vehicles:
        output.append({
            "id": v.id,
            "owner_id": v.owner_id,
            "owner_name": v.owner.full_name if v.owner else "Driver",
            "owner_phone": v.owner.phone if v.owner else None,
            "vehicle_type": v.vehicle_type,
            "make": v.make,
            "model": v.model,
            "plate_number": v.plate_number,
            "max_weight_tons": v.max_weight_tons,
            "max_volume_m3": v.max_volume_m3,
            "trailer_type": v.trailer_type,
            "current_country": v.current_country,
            "current_city": v.current_city,
            "preferred_destinations": v.preferred_destinations,
            "is_available": v.is_available,
            "has_adr": v.has_adr,
            "has_temperature_control": v.has_temperature_control,
            "temp_min": v.temp_min,
            "temp_max": v.temp_max,
            "created_at": v.created_at.isoformat()
        })
    return output

@router.post("/", response_model=dict)
async def create_vehicle(
    req: VehicleCreateRequest,
    current_user: User = Depends(require_roles([
        UserRole.DRIVER.value,
        UserRole.VEHICLE_OWNER.value,
        UserRole.TRANSPORT_COMPANY.value,
        UserRole.SUPER_ADMIN.value
    ])),
    db: AsyncSession = Depends(get_db)
):
    """
    Publish a vehicle. DRIVERS AND VEHICLE OWNERS NEVER PAY A SUBSCRIPTION OR COMMISSION.
    """
    new_vehicle = Vehicle(
        owner_id=current_user.id,
        vehicle_type=req.vehicle_type,
        make=req.make,
        model=req.model,
        plate_number=req.plate_number,
        max_weight_tons=req.max_weight_tons,
        max_volume_m3=req.max_volume_m3,
        trailer_type=req.trailer_type,
        current_country=req.current_country,
        current_city=req.current_city,
        current_lat=req.current_lat,
        current_lon=req.current_lon,
        preferred_destinations=req.preferred_destinations,
        has_adr=req.has_adr,
        has_temperature_control=req.has_temperature_control,
        temp_min=req.temp_min,
        temp_max=req.temp_max,
        verification_status=VerificationStatus.VERIFIED.value
    )
    db.add(new_vehicle)
    await db.commit()
    await db.refresh(new_vehicle)

    return {
        "success": True,
        "message": "Vehicle published successfully (100% FREE)",
        "vehicle_id": new_vehicle.id
    }

@router.get("/my")
async def get_my_vehicles(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Vehicle).where(Vehicle.owner_id == current_user.id).order_by(Vehicle.created_at.desc())
    res = await db.execute(stmt)
    vehicles = res.scalars().all()
    return [{
        "id": v.id,
        "vehicle_type": v.vehicle_type,
        "make": v.make,
        "model": v.model,
        "plate_number": v.plate_number,
        "max_weight_tons": v.max_weight_tons,
        "max_volume_m3": v.max_volume_m3,
        "current_country": v.current_country,
        "current_city": v.current_city,
        "is_available": v.is_available,
        "created_at": v.created_at.isoformat()
    } for v in vehicles]
