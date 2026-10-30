from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Dict, Any

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.entities import (
    User, Company, Vehicle, Load, LoadOffer, Subscription, Invoice, SubscriptionPlan, UserRole
)

router = APIRouter(prefix="/admin", tags=["Administrator Dashboard & Controls"])

@router.get("/metrics")
async def get_admin_metrics(
    admin_user: User = Depends(require_roles([UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value])),
    db: AsyncSession = Depends(get_db)
):
    """
    Real-time platform KPIs for admin operations.
    """
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_companies = (await db.execute(select(func.count(Company.id)))).scalar_one()
    total_vehicles = (await db.execute(select(func.count(Vehicle.id)))).scalar_one()
    total_loads = (await db.execute(select(func.count(Load.id)))).scalar_one()
    total_offers = (await db.execute(select(func.count(LoadOffer.id)))).scalar_one()
    
    # Calculate Monthly Recurring Revenue (MRR) strictly from logistics subscriptions
    mrr_result = (await db.execute(select(func.sum(Invoice.amount)).where(Invoice.status == "PAID"))).scalar_one() or 0.0

    return {
        "total_users": total_users,
        "total_companies": total_companies,
        "total_vehicles": total_vehicles,
        "total_loads": total_loads,
        "total_offers": total_offers,
        "mrr_uzs": mrr_result,
        "commission_rate": "0% (Zero freight commission guarantee)"
    }

@router.get("/users")
async def list_all_users(
    admin_user: User = Depends(require_roles([UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).order_by(User.created_at.desc())
    res = await db.execute(stmt)
    users = res.scalars().all()
    return [{
        "id": u.id,
        "phone": u.phone,
        "full_name": u.full_name,
        "role": u.role,
        "is_active": u.is_active,
        "verification_status": u.verification_status,
        "created_at": u.created_at.isoformat()
    } for u in users]

@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    action: str, # "ACTIVATE", "SUSPEND", "VERIFY"
    admin_user: User = Depends(require_roles([UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    if action == "SUSPEND":
        u.is_active = False
    elif action == "ACTIVATE":
        u.is_active = True
    elif action == "VERIFY":
        u.verification_status = "VERIFIED"

    await db.commit()
    return {"success": True, "message": f"User {user_id} updated: {action}"}
