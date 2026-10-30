from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime, timedelta
import uuid

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.entities import (
    SubscriptionPlan, Subscription, Invoice, Company, User, UserRole, SubscriptionStatus,
    SubscriptionApplication, ApplicationStatus, VerificationStatus
)
from app.schemas.dto import (
    SubscriptionPlanResponse, SubscribeRequest, SubscriptionApplicationCreate, SubscriptionApplicationReview
)

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions & Billing (Logistics Monetization)"])

@router.get("/plans")
async def get_plans(db: AsyncSession = Depends(get_db)):
    """
    Get all active subscription plans. 
    Notice: DRIVERS NEVER PAY; Plans apply ONLY to logistics companies and shippers.
    """
    stmt = select(SubscriptionPlan).where(SubscriptionPlan.is_active == True).order_by(SubscriptionPlan.price_uzs.asc())
    res = await db.execute(stmt)
    plans = res.scalars().all()
    return [{
        "id": p.id,
        "code": p.code,
        "name": p.name,
        "price_uzs": p.price_uzs,
        "active_loads_limit": p.active_loads_limit,
        "max_team_members": p.max_team_members,
        "advanced_search": p.advanced_search,
        "analytics_enabled": p.analytics_enabled,
        "priority_support": p.priority_support,
        "api_access": p.api_access
    } for p in plans]

@router.post("/subscribe")
async def subscribe(
    req: SubscribeRequest,
    current_user: User = Depends(require_roles([UserRole.LOGISTIC.value, UserRole.LOGISTICS_COMPANY_OWNER.value, UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value])),
    db: AsyncSession = Depends(get_db)
):
    """
    Subscribe or upgrade to a plan using Click, Payme, or Bank Transfer.
    Automatically assigns/creates Company for the logistic user if none exists.
    """
    # 1. Look for company owned by user
    stmt_comp = select(Company).where(Company.owner_id == current_user.id)
    res_comp = await db.execute(stmt_comp)
    company = res_comp.scalar_one_or_none()
    
    if not company:
        # Create company on the fly for logistics user
        company = Company(
            name=getattr(current_user, "company_name", None) or f"{current_user.full_name} Logistics",
            owner_id=current_user.id,
            city=current_user.city or "Tashkent",
            country=current_user.country or "Uzbekistan",
            verification_status="VERIFIED"
        )
        db.add(company)
        await db.flush()

    stmt_p = select(SubscriptionPlan).where(SubscriptionPlan.code == req.plan_code)
    res_p = await db.execute(stmt_p)
    plan = res_p.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")

    # Invalidate old active subscriptions
    stmt_old = select(Subscription).where(
        Subscription.company_id == company.id,
        Subscription.status == SubscriptionStatus.ACTIVE.value
    )
    res_old = await db.execute(stmt_old)
    for old_s in res_old.scalars().all():
        old_s.status = SubscriptionStatus.EXPIRED.value

    # Create new subscription (30 days)
    starts = datetime.utcnow()
    expires = starts + timedelta(days=30)
    new_sub = Subscription(
        company_id=company.id,
        plan_id=plan.id,
        status=SubscriptionStatus.ACTIVE.value,
        starts_at=starts,
        expires_at=expires,
        auto_renew=True
    )
    db.add(new_sub)
    await db.flush()

    # Create invoice record
    invoice = Invoice(
        subscription_id=new_sub.id,
        invoice_number=f"INV-{int(datetime.utcnow().timestamp())}",
        amount=plan.price_uzs,
        currency="UZS",
        status="PAID",
        payment_method=req.payment_method
    )
    db.add(invoice)

    await db.commit()
    await db.refresh(new_sub)

    return {
        "success": True,
        "message": f"Successfully activated {plan.name} subscription!",
        "subscription_id": new_sub.id,
        "expires_at": expires.isoformat(),
        "invoice_number": invoice.invoice_number
    }

@router.post("/application")
async def create_subscription_application(
    req: SubscriptionApplicationCreate,
    current_user: User = Depends(require_roles([
        UserRole.LOGISTIC.value, 
        UserRole.LOGISTICS_COMPANY_OWNER.value, 
        UserRole.TRANSPORT_COMPANY.value,
        UserRole.SUPER_ADMIN.value
    ])),
    db: AsyncSession = Depends(get_db)
):
    """
    Logist sozlamalar/kabinetidan obuna va to'lov arizasini jo'natadi.
    Bu ariza platforma egasining Admin Paneliga tushadi.
    """
    # 1. Update company details if exists or create
    stmt_comp = select(Company).where(Company.owner_id == current_user.id)
    comp = (await db.execute(stmt_comp)).scalar_one_or_none()
    if not comp:
        comp = Company(
            name=req.company_name,
            owner_id=current_user.id,
            contact_phone=req.contact_phone,
            verification_status=VerificationStatus.PENDING.value
        )
        db.add(comp)
        await db.flush()
    else:
        comp.name = req.company_name
        comp.contact_phone = req.contact_phone

    # 2. Check plan
    stmt_plan = select(SubscriptionPlan).where(SubscriptionPlan.code == req.plan_code)
    plan = (await db.execute(stmt_plan)).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Tanlangan obuna tarifi topilmadi")

    # 3. Create application
    app_record = SubscriptionApplication(
        user_id=current_user.id,
        company_name=req.company_name,
        contact_phone=req.contact_phone,
        extra_phone=req.extra_phone,
        plan_code=req.plan_code,
        payment_method=req.payment_method,
        comment=req.comment,
        status=ApplicationStatus.PENDING.value
    )
    db.add(app_record)
    await db.commit()
    await db.refresh(app_record)

    return {
        "success": True,
        "message": "Arizangiz qabul qilindi! Administrator to'lovni tasdiqlashi bilan profilingiz aktivlashtiriladi.",
        "application_id": app_record.id,
        "plan_name": plan.name,
        "price_uzs": plan.price_uzs
    }

@router.get("/my-application")
async def get_my_application(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(SubscriptionApplication).where(
        SubscriptionApplication.user_id == current_user.id
    ).order_by(SubscriptionApplication.created_at.desc())
    app_record = (await db.execute(stmt)).scalars().first()
    if not app_record:
        return {"has_application": False}

    return {
        "has_application": True,
        "id": app_record.id,
        "company_name": app_record.company_name,
        "contact_phone": app_record.contact_phone,
        "plan_code": app_record.plan_code,
        "payment_method": app_record.payment_method,
        "status": app_record.status,
        "admin_notes": app_record.admin_notes,
        "created_at": app_record.created_at.isoformat()
    }
@router.get("/my")
async def get_my_subscription(
    current_user: User = Depends(require_roles([UserRole.LOGISTIC.value, UserRole.LOGISTICS_COMPANY_OWNER.value, UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value])),
    db: AsyncSession = Depends(get_db)
):
    stmt_comp = select(Company).where(Company.owner_id == current_user.id)
    res_comp = await db.execute(stmt_comp)
    company = res_comp.scalar_one_or_none()
    if not company:
        return {"has_active_subscription": False}

    stmt_sub = select(Subscription).options(
        selectinload(Subscription.plan),
        selectinload(Subscription.invoices)
    ).where(
        Subscription.company_id == company.id,
        Subscription.status == SubscriptionStatus.ACTIVE.value
    )
    res_sub = await db.execute(stmt_sub)
    sub = res_sub.scalar_one_or_none()
    if not sub:
        return {"has_active_subscription": False}

    return {
        "has_active_subscription": True,
        "plan_name": sub.plan.name,
        "plan_code": sub.plan.code,
        "price_uzs": sub.plan.price_uzs,
        "starts_at": sub.starts_at.isoformat(),
        "expires_at": sub.expires_at.isoformat(),
        "active_loads_limit": sub.plan.active_loads_limit,
        "advanced_search": sub.plan.advanced_search,
        "invoices": [{
            "invoice_number": inv.invoice_number,
            "amount": inv.amount,
            "currency": inv.currency,
            "status": inv.status,
            "paid_at": inv.paid_at.isoformat()
        } for inv in sub.invoices]
    }
