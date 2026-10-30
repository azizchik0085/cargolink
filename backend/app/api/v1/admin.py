from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from typing import Dict, Any, List
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.entities import (
    User, Company, Vehicle, Load, LoadOffer, Subscription, Invoice, SubscriptionPlan, UserRole, DriverProfile
)

router = APIRouter(prefix="/admin", tags=["Administrator Dashboard & Platform Owner Controls"])

@router.get("/metrics")
async def get_admin_metrics(
    admin_user: User = Depends(require_roles([UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value])),
    db: AsyncSession = Depends(get_db)
):
    """
    Platform Owner KPIs: Drivers active/inactive, logistics paid/unpaid, and total revenue.
    """
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_companies = (await db.execute(select(func.count(Company.id)))).scalar_one()
    total_vehicles = (await db.execute(select(func.count(Vehicle.id)))).scalar_one()
    total_loads = (await db.execute(select(func.count(Load.id)))).scalar_one()

    # 1. Driver statistics
    total_drivers = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.DRIVER.value))).scalar_one()
    active_drivers = (await db.execute(select(func.count(User.id)).where(
        User.role == UserRole.DRIVER.value,
        User.is_active == True
    ))).scalar_one()
    inactive_drivers = total_drivers - active_drivers

    # Active trucks available right now
    active_trucks = (await db.execute(select(func.count(Vehicle.id)).where(Vehicle.is_available == True))).scalar_one()

    # 2. Logistics & Subscriptions statistics
    total_logistics = (await db.execute(select(func.count(User.id)).where(
        User.role.in_([UserRole.LOGISTICS_COMPANY_OWNER.value, UserRole.LOGISTIC.value])
    ))).scalar_one()

    # Active paying subscriptions
    active_subscriptions = (await db.execute(select(func.count(Subscription.id)).where(
        Subscription.status == "ACTIVE",
        Subscription.expires_at > datetime.utcnow()
    ))).scalar_one()

    # Total revenue collected (UZS)
    total_revenue_uzs = (await db.execute(select(func.sum(Invoice.amount)).where(Invoice.status == "PAID"))).scalar_one() or 0.0

    return {
        "total_users": total_users,
        "total_companies": total_companies,
        "total_vehicles": total_vehicles,
        "active_trucks_available": active_trucks,
        "total_loads": total_loads,
        "total_drivers": total_drivers,
        "active_drivers": active_drivers,
        "inactive_drivers": inactive_drivers,
        "total_logistics": total_logistics,
        "active_paid_subscriptions": active_subscriptions,
        "unpaid_or_expired_logistics": max(0, total_logistics - active_subscriptions),
        "total_revenue_uzs": total_revenue_uzs,
        "mrr_uzs": total_revenue_uzs,
        "commission_rate": "0% (Zero freight commission guarantee)"
    }

@router.get("/logistics-clients")
async def get_logistics_clients_status(
    admin_user: User = Depends(require_roles([UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value])),
    db: AsyncSession = Depends(get_db)
):
    """
    Detailed list of all logistics companies: who paid, which plan, active or expired.
    """
    stmt = select(Company).options(
        selectinload(Company.owner),
        selectinload(Company.subscriptions).selectinload(Subscription.plan),
        selectinload(Company.loads)
    ).order_by(Company.created_at.desc())
    
    res = await db.execute(stmt)
    companies = res.scalars().all()

    output = []
    now = datetime.utcnow()
    for c in companies:
        active_sub = None
        for s in c.subscriptions:
            if s.status == "ACTIVE" and s.expires_at > now:
                active_sub = s
                break

        # Invoices sum
        paid_invoices_stmt = select(func.sum(Invoice.amount)).join(Subscription).where(
            Subscription.company_id == c.id,
            Invoice.status == "PAID"
        )
        total_paid = (await db.execute(paid_invoices_stmt)).scalar_one() or 0.0

        output.append({
            "company_id": c.id,
            "company_name": c.name,
            "owner_name": c.owner.full_name if c.owner else "N/A",
            "owner_phone": c.owner.phone if c.owner else "N/A",
            "owner_id": c.owner.id if c.owner else None,
            "city": f"{c.city}, {c.country}",
            "is_active": c.owner.is_active if c.owner else True,
            "has_paid_subscription": active_sub is not None,
            "plan_code": active_sub.plan.code if active_sub else "NONE",
            "plan_name": active_sub.plan.name if active_sub else "To'lanmagan",
            "subscription_expires_at": active_sub.expires_at.isoformat() if active_sub else None,
            "total_loads_posted": len(c.loads),
            "total_amount_paid_uzs": total_paid,
            "created_at": c.created_at.isoformat()
        })
    return output

@router.get("/drivers-list")
async def get_drivers_list(
    admin_user: User = Depends(require_roles([UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value])),
    db: AsyncSession = Depends(get_db)
):
    """
    Detailed list of all drivers: active, inactive, truck count, trips, rating.
    """
    stmt = select(User).options(
        selectinload(User.driver_profile),
        selectinload(User.vehicles)
    ).where(User.role == UserRole.DRIVER.value).order_by(User.created_at.desc())

    res = await db.execute(stmt)
    drivers = res.scalars().all()

    output = []
    for d in drivers:
        dp = d.driver_profile
        output.append({
            "id": d.id,
            "full_name": d.full_name,
            "phone": d.phone,
            "city": f"{d.city}, {d.country}",
            "is_active": d.is_active,
            "verification_status": d.verification_status,
            "vehicles_count": len(d.vehicles),
            "rating": dp.rating if dp else 5.0,
            "completed_trips": dp.completed_trips if dp else 0,
            "registered_at": d.created_at.isoformat()
        })
    return output

@router.put("/users/{user_id}/status")
async def toggle_user_active_status(
    user_id: str,
    action: str, # "ACTIVATE", "DEACTIVATE", "VERIFY"
    admin_user: User = Depends(require_roles([UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    if action == "DEACTIVATE":
        u.is_active = False
    elif action == "ACTIVATE":
        u.is_active = True
    elif action == "VERIFY":
        u.verification_status = "VERIFIED"

    await db.commit()
    return {"success": True, "message": f"User status updated: {action}"}
