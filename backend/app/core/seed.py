from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta

from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.entities import (
    User, Company, DriverProfile, Vehicle, Load, SubscriptionPlan, Subscription, Invoice,
    UserRole, VerificationStatus, LoadStatus
)

async def seed_initial_data():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # 1. Seed Subscription Plans
        res = await db.execute(select(SubscriptionPlan))
        if not res.scalars().all():
            plans = [
                SubscriptionPlan(
                    code="START",
                    name="Start Plan",
                    price_uzs=199000.0,
                    active_loads_limit=5,
                    max_team_members=1,
                    advanced_search=True,
                    analytics_enabled=False,
                    priority_support=False,
                    api_access=False
                ),
                SubscriptionPlan(
                    code="STANDARD",
                    name="Standard Plan",
                    price_uzs=399000.0,
                    active_loads_limit=20,
                    max_team_members=3,
                    advanced_search=True,
                    analytics_enabled=True,
                    priority_support=False,
                    api_access=False
                ),
                SubscriptionPlan(
                    code="BUSINESS",
                    name="Business Plan",
                    price_uzs=699000.0,
                    active_loads_limit=100,
                    max_team_members=10,
                    advanced_search=True,
                    analytics_enabled=True,
                    priority_support=True,
                    api_access=False
                ),
                SubscriptionPlan(
                    code="ENTERPRISE",
                    name="Enterprise VIP",
                    price_uzs=1499000.0,
                    active_loads_limit=9999,
                    max_team_members=50,
                    advanced_search=True,
                    analytics_enabled=True,
                    priority_support=True,
                    api_access=True
                )
            ]
            db.add_all(plans)
            await db.flush()

        # 2. Seed Super Admin
        res_admin = await db.execute(select(User).where(User.phone == "+998900000001"))
        if not res_admin.scalar_one_or_none():
            admin_user = User(
                phone="+998900000001",
                full_name="CargoLink Super Admin",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.SUPER_ADMIN.value,
                verification_status=VerificationStatus.VERIFIED.value,
                city="Tashkent",
                country="Uzbekistan"
            )
            db.add(admin_user)

        # 3. Seed Demo Logistics Company & Owner
        res_shipper = await db.execute(select(User).where(User.phone == "+998901112233"))
        if not res_shipper.scalar_one_or_none():
            shipper = User(
                phone="+998901112233",
                full_name="Botir Qodirov (Silk Road Logistics)",
                hashed_password=get_password_hash("shipper123"),
                role=UserRole.LOGISTICS_COMPANY_OWNER.value,
                verification_status=VerificationStatus.VERIFIED.value,
                city="Tashkent",
                country="Uzbekistan"
            )
            db.add(shipper)
            await db.flush()

            company = Company(
                owner_id=shipper.id,
                name="Silk Road Global Logistics LLC",
                tax_id="308123456",
                country="Uzbekistan",
                city="Tashkent",
                address="Amir Temur shox ko'chasi 107",
                verification_status=VerificationStatus.VERIFIED.value
            )
            db.add(company)
            await db.flush()

            biz_plan = (await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.code == "BUSINESS"))).scalar_one()
            sub = Subscription(
                company_id=company.id,
                plan_id=biz_plan.id,
                status="ACTIVE",
                starts_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(days=365)
            )
            db.add(sub)
            await db.flush()

            sample_loads = [
                Load(
                    company_id=company.id,
                    created_by=shipper.id,
                    origin_country="Uzbekistan",
                    origin_city="Tashkent",
                    destination_country="Kazakhstan",
                    destination_city="Almaty",
                    loading_date=datetime.utcnow() + timedelta(days=2),
                    cargo_title="To'qimachilik mahsulotlari (Tekstil)",
                    cargo_category="Industrial Goods",
                    weight_kg=21500.0,
                    volume_m3=88.0,
                    required_vehicle_type="Curtain-sided truck (Tent)",
                    price=2200.0,
                    currency="USD",
                    is_negotiable=True,
                    status=LoadStatus.ACTIVE.value,
                    contact_name="Botir Qodirov",
                    contact_phone="+998901112233",
                    description="Tezkor yuk. Bojxona hujjatlari (TIR Carnet) tayyor. To'lov 100% tushirilganda."
                ),
                Load(
                    company_id=company.id,
                    created_by=shipper.id,
                    origin_country="Uzbekistan",
                    origin_city="Samarkand",
                    destination_country="Russia",
                    destination_city="Moscow",
                    loading_date=datetime.utcnow() + timedelta(days=3),
                    cargo_title="Meva va Sabzavotlar (Gilos, O'rik)",
                    cargo_category="Agricultural & Fresh Food",
                    weight_kg=19000.0,
                    volume_m3=82.0,
                    required_vehicle_type="Refrigerated truck (Ref)",
                    requires_temperature=True,
                    temp_min=2.0,
                    temp_max=5.0,
                    price=5800.0,
                    currency="USD",
                    is_negotiable=False,
                    status=LoadStatus.ACTIVE.value,
                    contact_name="Botir Qodirov",
                    contact_phone="+998901112233",
                    description="Muzlatgich harorati qat'iy +3C bo'lishi kerak. Sensorlar nazoratda."
                ),
                Load(
                    company_id=company.id,
                    created_by=shipper.id,
                    origin_country="Uzbekistan",
                    origin_city="Fergana",
                    destination_country="Turkey",
                    destination_city="Istanbul",
                    loading_date=datetime.utcnow() + timedelta(days=5),
                    cargo_title="Paxta kalavasi (Yarn)",
                    cargo_category="Raw Materials",
                    weight_kg=22000.0,
                    volume_m3=92.0,
                    required_vehicle_type="Curtain-sided truck (Tent)",
                    price=3900.0,
                    currency="USD",
                    is_negotiable=True,
                    status=LoadStatus.ACTIVE.value,
                    contact_name="Botir Qodirov",
                    contact_phone="+998901112233",
                    description="Eksport shartnomasi asosida. Tranzit Ozarbayjon / Gruziya orqali."
                )
            ]
            db.add_all(sample_loads)

        # 4. Seed Demo Truck Driver (100% Free)
        res_driver = await db.execute(select(User).where(User.phone == "+998934445566"))
        if not res_driver.scalar_one_or_none():
            driver = User(
                phone="+998934445566",
                full_name="Jamshid Haydarov",
                hashed_password=get_password_hash("driver123"),
                role=UserRole.DRIVER.value,
                verification_status=VerificationStatus.VERIFIED.value,
                city="Tashkent",
                country="Uzbekistan"
            )
            db.add(driver)
            await db.flush()

            dp = DriverProfile(
                user_id=driver.id,
                license_number="UZ8899221",
                experience_years=8,
                verification_status=VerificationStatus.VERIFIED.value,
                rating=4.9,
                completed_trips=42,
                total_distance_km=14200.0,
                countries_visited=5
            )
            db.add(dp)

            truck = Vehicle(
                owner_id=driver.id,
                vehicle_type="Curtain-sided truck (Tent)",
                make="Volvo",
                model="FH 540 Globetrotter",
                plate_number="01 A 777 GA",
                max_weight_tons=23.0,
                max_volume_m3=92.0,
                current_country="Uzbekistan",
                current_city="Tashkent",
                preferred_destinations="Kazakhstan, Russia, Turkey, Belarus",
                is_available=True,
                verification_status=VerificationStatus.VERIFIED.value
            )
            db.add(truck)

        await db.commit()
