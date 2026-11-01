from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.core.dependencies import get_current_user
from app.models.entities import User, Company, DriverProfile, Vehicle, UserRole, VerificationStatus, Subscription, SubscriptionPlan, SubscriptionStatus
from app.schemas.dto import UserRegisterRequest, UserLoginRequest, TokenResponse, UserResponse
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["Authentication & Profiles"])

def normalize_phone_number(phone: str) -> str:
    """O'zbekiston va xalqaro raqamlarni bir xil formatga (+998XXXXXXXXX) keltirish"""
    if not phone:
        return ""
    cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
    if not cleaned.startswith('+'):
        if cleaned.startswith('998'):
            cleaned = '+' + cleaned
        elif len(cleaned) == 9:
            cleaned = '+998' + cleaned
        else:
            cleaned = '+' + cleaned
    return cleaned

@router.post("/register", response_model=TokenResponse)
async def register(req: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    clean_phone = normalize_phone_number(req.phone)
    if not clean_phone or len(clean_phone) < 9:
        raise HTTPException(
            status_code=400,
            detail="Telefon raqami noto'g'ri kiritildi!"
        )

    # 1. Bitta telefon raqam faqat bir marta ro'yxatdan o'tishi mumkin
    stmt = select(User).where(User.phone == clean_phone)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=400, 
            detail="Ushbu telefon raqami allaqachon ro'yxatdan o'tgan! Bitta haydovchi faqat 1 marta ro'yxatdan o'tishi mumkin."
        )

    # 2. Haydovchi uchun mashina raqami va texpasport raqami majburiy va takrorlanmas (unikal) bo'lishi kerak
    clean_plate = None
    clean_tech_pass = None
    if req.role in [UserRole.DRIVER.value, UserRole.VEHICLE_OWNER.value]:
        if not req.plate_number or not req.plate_number.strip():
            raise HTTPException(
                status_code=400, 
                detail="Haydovchi ro'yxatdan o'tishi uchun mashina davlat raqamini kiritish majburiy!"
            )
        if not req.tech_passport_number or not req.tech_passport_number.strip():
            raise HTTPException(
                status_code=400, 
                detail="Haydovchi ro'yxatdan o'tishi uchun avtomobil texpasport raqamini kiritish majburiy!"
            )
        
        clean_plate = req.plate_number.strip().upper()
        clean_tech_pass = req.tech_passport_number.strip().upper()

        # Mashina raqami oldin ro'yxatdan o'tganligini tekshirish
        v_plate_stmt = select(Vehicle).where(Vehicle.plate_number == clean_plate)
        if (await db.execute(v_plate_stmt)).scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Ushbu mashina raqami ({clean_plate}) allaqachon tizimda ro'yxatdan o'tgan! Bitta mashinani qayta ro'yxatdan o'tkazish mumkin emas."
            )

        # Texpasport raqami oldin ro'yxatdan o'tganligini tekshirish
        v_tech_stmt = select(Vehicle).where(Vehicle.tech_passport_number == clean_tech_pass)
        if (await db.execute(v_tech_stmt)).scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Ushbu texpasport raqami ({clean_tech_pass}) bilan avtomobil allaqachon ro'yxatdan o'tgan!"
            )

    new_user = User(
        phone=clean_phone,
        hashed_password=get_password_hash(req.password),
        full_name=req.full_name,
        role=req.role,
        preferred_language=req.preferred_language or "uz",
        verification_status=VerificationStatus.VERIFIED.value if req.role in [UserRole.DRIVER.value, UserRole.VEHICLE_OWNER.value] else VerificationStatus.PENDING.value
    )
    db.add(new_user)
    await db.flush()

    # Flow A: Logistics Company Owner (Yangi logist to'lov qilib admin tasdiqlamaguncha PENDING holatda turadi)
    if req.role in [UserRole.LOGISTIC.value, UserRole.LOGISTICS_COMPANY_OWNER.value]:
        company_name = req.company_name or f"{req.full_name}'s Logistics"
        company = Company(
            owner_id=new_user.id,
            name=company_name,
            tax_id=req.tax_id,
            country=req.country or "Uzbekistan",
            city=req.city or "Tashkent",
            verification_status=VerificationStatus.PENDING.value
        )
        db.add(company)
        await db.flush()

    # Flow B: Driver / Vehicle Owner
    elif req.role in [UserRole.DRIVER.value, UserRole.VEHICLE_OWNER.value]:
        driver_prof = DriverProfile(
            user_id=new_user.id,
            license_number=req.license_number or "AA1234567",
            experience_years=req.experience_years or 3,
            verification_status=VerificationStatus.VERIFIED.value
        )
        db.add(driver_prof)

        # Mashinani avtomatik ro'yxatdan o'tkazish (mashina raqami va texpasport bilan)
        vehicle = Vehicle(
            owner_id=new_user.id,
            assigned_driver_id=new_user.id,
            plate_number=clean_plate,
            tech_passport_number=clean_tech_pass,
            vehicle_type=req.vehicle_type or "Curtain-sided truck (Tent)",
            make=req.vehicle_make or "Volvo",
            model=req.vehicle_model or "FH 500",
            max_weight_tons=req.max_weight_tons or 22.0,
            max_volume_m3=req.max_volume_m3 or 92.0,
            current_country="Uzbekistan",
            current_city=req.city or "Tashkent",
            preferred_destinations="Kazakhstan, Russia, Turkey",
            verification_status=VerificationStatus.VERIFIED.value,
            is_available=True
        )
        db.add(vehicle)

    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(subject=new_user.id, role=new_user.role)
    refresh_token = create_refresh_token(subject=new_user.id, role=new_user.role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": new_user.id,
            "phone": new_user.phone,
            "full_name": new_user.full_name,
            "role": new_user.role,
            "verification_status": new_user.verification_status,
            "preferred_language": new_user.preferred_language
        }
    )

@router.post("/login", response_model=TokenResponse)
async def login(req: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    clean_phone = normalize_phone_number(req.phone)
    # Telefon raqamni toza ko'rinishda (+998...) yoki foydalanuvchi kiritgan asl holatida qidirish
    stmt = select(User).where((User.phone == clean_phone) | (User.phone == req.phone))
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Telefon raqam yoki parol noto'g'ri kiritildi")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account has been deactivated")

    access_token = create_access_token(subject=user.id, role=user.role)
    refresh_token = create_refresh_token(subject=user.id, role=user.role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": user.id,
            "phone": user.phone,
            "full_name": user.full_name,
            "role": user.role,
            "verification_status": user.verification_status,
            "preferred_language": user.preferred_language
        }
    )

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    data = {
        "id": current_user.id,
        "phone": current_user.phone,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "verification_status": current_user.verification_status,
        "preferred_language": current_user.preferred_language,
        "created_at": current_user.created_at.isoformat()
    }

    # Fetch company if owner
    stmt_comp = select(Company).where(Company.owner_id == current_user.id)
    res_comp = await db.execute(stmt_comp)
    company = res_comp.scalar_one_or_none()
    if company:
        # Check active subscription
        stmt_sub = select(Subscription).options(selectinload(Subscription.plan)).where(
            Subscription.company_id == company.id,
            Subscription.status == SubscriptionStatus.ACTIVE.value
        ).order_by(Subscription.expires_at.desc())
        res_sub = await db.execute(stmt_sub)
        sub = res_sub.scalar_one_or_none()

        data["company"] = {
            "id": company.id,
            "name": company.name,
            "country": company.country,
            "city": company.city,
            "verification_status": company.verification_status,
            "subscription": {
                "plan_code": sub.plan.code,
                "plan_name": sub.plan.name,
                "expires_at": sub.expires_at.isoformat(),
                "active_loads_limit": sub.plan.active_loads_limit,
                "advanced_search": sub.plan.advanced_search
            } if sub else None
        }

    # Fetch driver profile if driver
    stmt_dp = select(DriverProfile).where(DriverProfile.user_id == current_user.id)
    res_dp = await db.execute(stmt_dp)
    dp = res_dp.scalar_one_or_none()
    if dp:
        data["driver_profile"] = {
            "license_number": dp.license_number,
            "rating": dp.rating,
            "completed_trips": dp.completed_trips,
            "is_available": dp.is_available,
            "verification_status": dp.verification_status
        }

    return data
