from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.entities import (
    User, Company, DriverProfile, Vehicle, Load, LoadOffer, 
    OrderStatusHistory, Review, UserRole, LoadStatus, OfferStatus
)

router = APIRouter(prefix="/dashboard", tags=["Personal Dashboards for All Roles"])

# ----------------- 1. LOGISTIC DASHBOARD -----------------

@router.get("/logistic")
async def get_logistic_dashboard(
    current_user: User = Depends(require_roles([
        UserRole.LOGISTIC.value,
        UserRole.LOGISTICS_COMPANY_OWNER.value,
        UserRole.SUPER_ADMIN.value
    ])),
    db: AsyncSession = Depends(get_db)
):
    """
    Personal dashboard for logistics agents and company owners.
    """
    # 1. Fetch user's company and active subscription
    stmt_comp = select(Company).where(Company.owner_id == current_user.id)
    comp_res = await db.execute(stmt_comp)
    company = comp_res.scalar_one_or_none()
    company_id = company.id if company else None

    # 2. Fetch loads created by this user or their company
    load_filter = [Load.created_by == current_user.id]
    if company_id:
        load_filter.append(Load.company_id == company_id)
    
    loads_stmt = select(Load).options(
        selectinload(Load.assigned_driver),
        selectinload(Load.assigned_vehicle),
        selectinload(Load.offers)
    ).where(Load.created_by == current_user.id).order_by(Load.created_at.desc())
    
    loads_res = await db.execute(loads_stmt)
    my_loads = loads_res.scalars().all()

    # Calculate statistics
    total_posted = len(my_loads)
    active_loads = len([l for l in my_loads if l.status in ["ACTIVE", "PUBLISHED"]])
    negotiating = len([l for l in my_loads if l.status in ["NEGOTIATION", "OFFERS_RECEIVED"]])
    assigned = len([l for l in my_loads if l.status in ["ASSIGNED", "LOADING", "IN_TRANSIT", "MATCHED"]])
    completed = len([l for l in my_loads if l.status in ["COMPLETED", "DELIVERED"]])
    cancelled = len([l for l in my_loads if l.status in ["CANCELLED", "EXPIRED"]])

    total_offers = sum(len(l.offers) for l in my_loads)
    drivers_contacted = len(set(o.driver_id for l in my_loads for o in l.offers))

    loads_data = []
    for l in my_loads:
        loads_data.append({
            "id": l.id,
            "cargo_title": l.cargo_title,
            "cargo_category": l.cargo_category,
            "origin": f"{l.origin_city}, {l.origin_country}",
            "destination": f"{l.destination_city}, {l.destination_country}",
            "loading_date": l.loading_date.isoformat(),
            "weight_kg": l.weight_kg,
            "volume_m3": l.volume_m3,
            "required_vehicle_type": l.required_vehicle_type,
            "price": l.price,
            "currency": l.currency,
            "status": l.status,
            "is_paused": l.is_paused,
            "views_count": l.views_count,
            "offers_count": len(l.offers),
            "assigned_driver": {
                "id": l.assigned_driver.id,
                "name": l.assigned_driver.full_name,
                "phone": l.assigned_driver.phone
            } if l.assigned_driver else None,
            "assigned_vehicle": {
                "plate_number": l.assigned_vehicle.plate_number,
                "make_model": f"{l.assigned_vehicle.make} {l.assigned_vehicle.model}"
            } if l.assigned_vehicle else None,
            "created_at": l.created_at.isoformat()
        })

    return {
        "profile": {
            "full_name": current_user.full_name,
            "phone": current_user.phone,
            "email": current_user.email,
            "role": current_user.role,
            "city": current_user.city,
            "country": current_user.country,
            "verification_status": current_user.verification_status,
            "company_name": company.name if company else None,
            "company_address": company.address if company else None,
            "registration_date": current_user.created_at.isoformat()
        },
        "statistics": {
            "total_posted_loads": total_posted,
            "active_loads": active_loads,
            "loads_in_negotiation": negotiating,
            "assigned_loads": assigned,
            "completed_loads": completed,
            "cancelled_loads": cancelled,
            "total_offers_received": total_offers,
            "drivers_contacted": drivers_contacted
        },
        "my_loads": loads_data
    }

# ----------------- 2. DRIVER DASHBOARD -----------------

@router.get("/driver")
async def get_driver_dashboard(
    current_user: User = Depends(require_roles([
        UserRole.DRIVER.value,
        UserRole.SUPER_ADMIN.value
    ])),
    db: AsyncSession = Depends(get_db)
):
    """
    Personal dashboard for truck drivers. 100% FREE.
    """
    # 1. Driver profile
    stmt_dp = select(DriverProfile).where(DriverProfile.user_id == current_user.id)
    dp = (await db.execute(stmt_dp)).scalar_one_or_none()

    # 2. Driver's registered vehicles
    stmt_v = select(Vehicle).where(Vehicle.owner_id == current_user.id).order_by(Vehicle.created_at.desc())
    my_vehicles = (await db.execute(stmt_v)).scalars().all()

    # 3. Offers submitted by this driver
    stmt_off = select(LoadOffer).options(selectinload(LoadOffer.load)).where(LoadOffer.driver_id == current_user.id).order_by(LoadOffer.created_at.desc())
    my_offers = (await db.execute(stmt_off)).scalars().all()

    # 4. Assigned and completed trips
    stmt_assigned = select(Load).options(selectinload(Load.creator), selectinload(Load.assigned_vehicle)).where(
        Load.assigned_driver_id == current_user.id
    ).order_by(Load.loading_date.desc())
    my_trips = (await db.execute(stmt_assigned)).scalars().all()

    # Calculate statistics
    total_orders = len(my_offers) + len(my_trips)
    completed = len([t for t in my_trips if t.status in ["COMPLETED", "DELIVERED"]])
    in_transit = len([t for t in my_trips if t.status in ["IN_TRANSIT", "LOADING", "ASSIGNED"]])
    pending_offers = len([o for o in my_offers if o.status == "PENDING"])
    accepted_offers = len([o for o in my_offers if o.status == "ACCEPTED"])

    # Completed trip metrics
    total_weight = sum(t.weight_kg for t in my_trips if t.status in ["COMPLETED", "DELIVERED"]) / 1000.0

    return {
        "profile": {
            "full_name": current_user.full_name,
            "phone": current_user.phone,
            "email": current_user.email,
            "role": current_user.role,
            "current_city": current_user.city,
            "current_country": current_user.country,
            "verification_status": current_user.verification_status,
            "license_categories": dp.license_categories if dp else "C, E",
            "experience_years": dp.experience_years if dp else 3,
            "rating": dp.rating if dp else 5.0,
            "completed_trips": dp.completed_trips if dp else completed,
            "languages": dp.languages if dp else "Uzbek, Russian"
        },
        "statistics": {
            "total_orders": total_orders,
            "completed_orders": completed,
            "orders_in_progress": in_transit,
            "pending_offers": pending_offers,
            "accepted_offers": accepted_offers,
            "total_cargo_weight_transported_tons": total_weight,
            "total_distance_km": dp.total_distance_km if dp else 12500.0,
            "countries_visited": dp.countries_visited if dp else 4
        },
        "vehicles": [{
            "id": v.id,
            "make": v.make,
            "model": v.model,
            "year": v.year,
            "plate_number": v.plate_number,
            "vehicle_type": v.vehicle_type,
            "trailer_type": v.trailer_type,
            "max_weight_tons": v.max_weight_tons,
            "max_volume_m3": v.max_volume_m3,
            "current_location": f"{v.current_city}, {v.current_country}",
            "preferred_destinations": v.preferred_destinations,
            "is_available": v.is_available,
            "has_adr": v.has_adr,
            "has_temperature_control": v.has_temperature_control,
            "insurance_info": v.insurance_info,
            "permits_info": v.permits_info
        } for v in my_vehicles],
        "my_orders": [{
            "offer_id": o.id,
            "load_id": o.load_id,
            "cargo_title": o.load.cargo_title if o.load else "Cargo",
            "route": f"{o.load.origin_city}, {o.load.origin_country} ➔ {o.load.destination_city}, {o.load.destination_country}" if o.load else "",
            "proposed_price": o.proposed_price,
            "currency": o.currency,
            "pickup_date": o.pickup_date.isoformat(),
            "status": o.status,
            "comment": o.comment,
            "created_at": o.created_at.isoformat()
        } for o in my_offers],
        "trip_history": [{
            "id": t.id,
            "cargo_title": t.cargo_title,
            "origin": f"{t.origin_city}, {t.origin_country}",
            "destination": f"{t.destination_city}, {t.destination_country}",
            "loading_date": t.loading_date.isoformat(),
            "weight_kg": t.weight_kg,
            "price": t.price,
            "currency": t.currency,
            "status": t.status,
            "contact_name": t.contact_name,
            "contact_phone": t.contact_phone
        } for t in my_trips]
    }

# ----------------- 3. FLEET OWNER / TRANSPORT COMPANY DASHBOARD -----------------

@router.get("/fleet")
async def get_fleet_dashboard(
    current_user: User = Depends(require_roles([
        UserRole.TRANSPORT_COMPANY.value,
        UserRole.VEHICLE_OWNER.value,
        UserRole.SUPER_ADMIN.value
    ])),
    db: AsyncSession = Depends(get_db)
):
    """
    Fleet management dashboard for transport companies and vehicle owners.
    """
    # 1. All vehicles owned by this company
    stmt_v = select(Vehicle).options(selectinload(Vehicle.assigned_driver)).where(
        Vehicle.owner_id == current_user.id
    ).order_by(Vehicle.created_at.desc())
    fleet_vehicles = (await db.execute(stmt_v)).scalars().all()

    # 2. Company trips
    vehicle_ids = [v.id for v in fleet_vehicles]
    fleet_trips = []
    if vehicle_ids:
        stmt_t = select(Load).options(selectinload(Load.assigned_driver), selectinload(Load.assigned_vehicle)).where(
            Load.assigned_vehicle_id.in_(vehicle_ids)
        ).order_by(Load.loading_date.desc())
        fleet_trips = (await db.execute(stmt_t)).scalars().all()

    available_count = len([v for v in fleet_vehicles if v.is_available])
    in_transit_count = len([v for v in fleet_vehicles if not v.is_available])

    return {
        "profile": {
            "company_name": current_user.full_name,
            "phone": current_user.phone,
            "city": current_user.city,
            "country": current_user.country,
            "verification_status": current_user.verification_status,
            "total_fleet_count": len(fleet_vehicles)
        },
        "fleet_statistics": {
            "total_vehicles": len(fleet_vehicles),
            "available_vehicles": available_count,
            "vehicles_on_trip": in_transit_count,
            "active_orders": len([t for t in fleet_trips if t.status in ["IN_TRANSIT", "LOADING", "ASSIGNED"]]),
            "completed_trips": len([t for t in fleet_trips if t.status in ["COMPLETED", "DELIVERED"]])
        },
        "vehicles": [{
            "id": v.id,
            "make": v.make,
            "model": v.model,
            "year": v.year,
            "plate_number": v.plate_number,
            "vehicle_type": v.vehicle_type,
            "max_weight_tons": v.max_weight_tons,
            "current_location": f"{v.current_city}, {v.current_country}",
            "is_available": v.is_available,
            "assigned_driver": {
                "id": v.assigned_driver.id,
                "name": v.assigned_driver.full_name,
                "phone": v.assigned_driver.phone
            } if v.assigned_driver else None
        } for v in fleet_vehicles],
        "trips": [{
            "id": t.id,
            "cargo_title": t.cargo_title,
            "route": f"{t.origin_city}, {t.origin_country} ➔ {t.destination_city}, {t.destination_country}",
            "vehicle_plate": t.assigned_vehicle.plate_number if t.assigned_vehicle else "",
            "driver_name": t.assigned_driver.full_name if t.assigned_driver else "",
            "status": t.status,
            "price": f"{t.price} {t.currency}"
        } for t in fleet_trips]
    }

# ----------------- 4. LOAD MANAGEMENT ACTIONS -----------------

@router.put("/loads/{load_id}/status")
async def update_load_status(
    load_id: str,
    new_status: str, # DRAFT, ACTIVE, NEGOTIATION, ACCEPTED, ASSIGNED, LOADING, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED
    driver_id: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    comment: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates load status and logs every transition into OrderStatusHistory.
    """
    stmt = select(Load).where(Load.id == load_id)
    res = await db.execute(stmt)
    load = res.scalar_one_or_none()
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    # Verify authorization: Only creator, assigned driver, or admin can update
    is_creator = load.created_by == current_user.id
    is_driver = load.assigned_driver_id == current_user.id
    is_admin = current_user.role in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]

    if not (is_creator or is_driver or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to update this load")

    old_status = load.status
    load.status = new_status
    if driver_id:
        load.assigned_driver_id = driver_id
    if vehicle_id:
        load.assigned_vehicle_id = vehicle_id

    # Create immutable audit history record
    history = OrderStatusHistory(
        load_id=load.id,
        from_status=old_status,
        to_status=new_status,
        changed_by_user_id=current_user.id,
        comment=comment or f"Status changed from {old_status} to {new_status}"
    )
    db.add(history)
    await db.commit()

    return {
        "success": True,
        "message": f"Load status updated to {new_status}",
        "load_id": load.id,
        "history_id": history.id
    }

@router.put("/loads/{load_id}/pause")
async def toggle_pause_load(
    load_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Load).where(Load.id == load_id, Load.created_by == current_user.id)
    res = await db.execute(stmt)
    load = res.scalar_one_or_none()
    if not load:
        raise HTTPException(status_code=404, detail="Load not found or not owned by user")

    load.is_paused = not load.is_paused
    await db.commit()
    return {
        "success": True,
        "is_paused": load.is_paused,
        "message": f"Load {'paused' if load.is_paused else 'activated'}"
    }

# ----------------- 5. REVIEWS & RATINGS -----------------

@router.post("/reviews")
async def submit_review(
    order_id: str,
    target_id: str,
    rating: int, # 1 - 5
    comment: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Submits a review after order completion. Prevents duplicate reviews.
    """
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    # Check if duplicate review exists for this order & author
    dup_stmt = select(Review).where(Review.order_id == order_id, Review.author_id == current_user.id)
    dup_res = await db.execute(dup_stmt)
    if dup_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already submitted a review for this order")

    review = Review(
        order_id=order_id,
        author_id=current_user.id,
        target_id=target_id,
        rating=rating,
        comment=comment
    )
    db.add(review)

    # Recalculate target's average rating
    stmt_avg = select(func.avg(Review.rating)).where(Review.target_id == target_id)
    avg_rating = (await db.execute(stmt_avg)).scalar_one() or float(rating)

    # If target is driver, update driver_profile
    stmt_dp = select(DriverProfile).where(DriverProfile.user_id == target_id)
    dp = (await db.execute(stmt_dp)).scalar_one_or_none()
    if dp:
        dp.rating = round(float(avg_rating), 1)

    await db.commit()
    return {"success": True, "message": "Review submitted successfully", "review_id": review.id}
