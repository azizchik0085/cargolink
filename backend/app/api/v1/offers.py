from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.entities import (
    LoadOffer, Load, Vehicle, User, UserRole, OfferStatus, LoadStatus, Notification, OrderStatusHistory
)
from app.schemas.dto import OfferCreateRequest, OfferResponse

router = APIRouter(prefix="/offers", tags=["Offers & Negotiation (Direct Negotiation, 0% Commission)"])

@router.post("/", response_model=dict)
async def submit_offer(
    req: OfferCreateRequest,
    current_user: User = Depends(require_roles([
        UserRole.DRIVER.value,
        UserRole.VEHICLE_OWNER.value,
        UserRole.TRANSPORT_COMPANY.value,
        UserRole.SUPER_ADMIN.value
    ])),
    db: AsyncSession = Depends(get_db)
):
    """
    Driver submits an offer for cargo. 
    100% FREE. Platform does NOT charge commission or take payments.
    """
    stmt = select(Load).where(Load.id == req.load_id)
    res = await db.execute(stmt)
    load = res.scalar_one_or_none()
    if not load:
        raise HTTPException(status_code=404, detail="Cargo not found")

    new_offer = LoadOffer(
        load_id=req.load_id,
        driver_id=current_user.id,
        vehicle_id=req.vehicle_id,
        proposed_price=req.proposed_price,
        currency=req.currency,
        pickup_date=req.pickup_date,
        delivery_date=req.delivery_date,
        comment=req.comment,
        status=OfferStatus.PENDING.value
    )
    db.add(new_offer)
    
    # Update load status to NEGOTIATION
    old_status = load.status
    load.status = LoadStatus.NEGOTIATION.value

    # Record history log
    history = OrderStatusHistory(
        load_id=load.id,
        from_status=old_status,
        to_status=LoadStatus.NEGOTIATION.value,
        changed_by_user_id=current_user.id,
        comment=f"Offer received from driver: {req.proposed_price} {req.currency}"
    )
    db.add(history)

    # Send in-app notification to cargo creator
    notif = Notification(
        user_id=load.created_by,
        title="Yangi narx taklifi!",
        message=f"{current_user.full_name} sizning yukingizga ({load.cargo_title}) {req.proposed_price} {req.currency} taklif qildi.",
        event_type="NEW_OFFER",
        link_url=f"/loads/{load.id}"
    )
    db.add(notif)

    await db.commit()
    await db.refresh(new_offer)

    return {
        "success": True,
        "message": "Offer submitted directly to logistics company (0% commission)",
        "offer_id": new_offer.id
    }

@router.get("/load/{load_id}")
async def get_load_offers(
    load_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt_load = select(Load).where(Load.id == load_id)
    res_load = await db.execute(stmt_load)
    load = res_load.scalar_one_or_none()
    if not load:
        raise HTTPException(status_code=404, detail="Cargo not found")

    stmt = select(LoadOffer).options(
        selectinload(LoadOffer.driver),
        selectinload(LoadOffer.vehicle)
    ).where(LoadOffer.load_id == load_id).order_by(LoadOffer.created_at.desc())
    
    res = await db.execute(stmt)
    offers = res.scalars().all()

    output = []
    for o in offers:
        output.append({
            "id": o.id,
            "proposed_price": o.proposed_price,
            "currency": o.currency,
            "pickup_date": o.pickup_date.isoformat(),
            "delivery_date": o.delivery_date.isoformat() if o.delivery_date else None,
            "comment": o.comment,
            "status": o.status,
            "driver_name": o.driver.full_name if o.driver else "Driver",
            "driver_phone": o.driver.phone if o.driver else None,
            "vehicle_type": o.vehicle.vehicle_type if o.vehicle else None,
            "vehicle_plate": o.vehicle.plate_number if o.vehicle else None,
            "created_at": o.created_at.isoformat()
        })
    return output

@router.put("/{offer_id}/status")
async def update_offer_status(
    offer_id: str,
    action: str, # ACCEPT, REJECT
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(LoadOffer).options(selectinload(LoadOffer.load)).where(LoadOffer.id == offer_id)
    res = await db.execute(stmt)
    offer = res.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    old_load_status = offer.load.status

    if action == "ACCEPT":
        offer.status = OfferStatus.ACCEPTED.value
        offer.load.status = LoadStatus.ACCEPTED.value
        offer.load.assigned_driver_id = offer.driver_id
        offer.load.assigned_vehicle_id = offer.vehicle_id
        notif_msg = f"Tabriklaymiz! Sizning {offer.load.cargo_title} yuki bo'yicha taklifingiz qabul qilindi. Mijoz bilan bevosita bog'laning."
        
        # Log to OrderStatusHistory
        history = OrderStatusHistory(
            load_id=offer.load.id,
            from_status=old_load_status,
            to_status=LoadStatus.ACCEPTED.value,
            changed_by_user_id=current_user.id,
            comment=f"Offer accepted from driver {offer.driver_id}"
        )
        db.add(history)

    elif action == "REJECT":
        offer.status = OfferStatus.REJECTED.value
        notif_msg = f"Sizning {offer.load.cargo_title} yuki bo'yicha taklifingiz rad etildi."
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    # Notify driver
    notif = Notification(
        user_id=offer.driver_id,
        title="Taklif holati o'zgardi",
        message=notif_msg,
        event_type="OFFER_STATUS",
        link_url=f"/loads/{offer.load_id}"
    )
    db.add(notif)
    await db.commit()

    return {
        "success": True,
        "message": f"Offer status updated to {offer.status}. (Transaction arrangements are directly between parties; 0% commission)"
    }
