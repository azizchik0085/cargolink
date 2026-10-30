from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime

# ----------------- AUTH SCHEMAS -----------------

class UserRegisterRequest(BaseModel):
    phone: str = Field(..., example="+998901234567")
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., example="Alisher Navoiy")
    role: str = Field(..., example="DRIVER")  # DRIVER, LOGISTICS_COMPANY_OWNER, VEHICLE_OWNER
    preferred_language: Optional[str] = "uz"
    
    # Extra fields for Logistics Company
    company_name: Optional[str] = None
    tax_id: Optional[str] = None
    country: Optional[str] = "Uzbekistan"
    city: Optional[str] = "Tashkent"

    # Extra fields for Driver
    license_number: Optional[str] = None
    experience_years: Optional[int] = 3

class UserLoginRequest(BaseModel):
    phone: str = Field(..., example="+998901234567")
    password: str = Field(..., min_length=4)

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

class UserResponse(BaseModel):
    id: str
    phone: str
    email: Optional[str] = None
    full_name: str
    role: str
    verification_status: str
    avatar_url: Optional[str] = None
    preferred_language: str
    company: Optional[dict] = None
    driver_profile: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ----------------- LOAD SCHEMAS -----------------

class LoadCreateRequest(BaseModel):
    origin_country: str = "Uzbekistan"
    origin_city: str
    origin_address: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lon: Optional[float] = None

    destination_country: str = "Kazakhstan"
    destination_city: str
    destination_address: Optional[str] = None
    destination_lat: Optional[float] = None
    destination_lon: Optional[float] = None

    loading_date: datetime
    delivery_deadline: Optional[datetime] = None

    cargo_title: str
    cargo_category: str = "General Cargo"
    weight_kg: float
    volume_m3: float
    pallets_count: Optional[int] = 0

    required_vehicle_type: str
    requires_temperature: bool = False
    temp_min: Optional[float] = None
    temp_max: Optional[float] = None
    is_adr: bool = False
    adr_class: Optional[str] = None

    price: float
    currency: str = "USD"
    is_negotiable: bool = True
    payment_terms: str = "Direct bank transfer / Cash upon delivery"
    contact_phone: str
    contact_name: str
    description: Optional[str] = None

class LoadResponse(BaseModel):
    id: str
    company_id: Optional[str] = None
    created_by: str
    origin_country: str
    origin_city: str
    destination_country: str
    destination_city: str
    loading_date: datetime
    delivery_deadline: Optional[datetime]
    cargo_title: str
    cargo_category: str
    weight_kg: float
    volume_m3: float
    required_vehicle_type: str
    requires_temperature: bool
    is_adr: bool
    price: float
    currency: str
    is_negotiable: bool
    contact_phone: str
    contact_name: str
    description: Optional[str]
    status: str
    created_at: datetime
    company: Optional[dict] = None

    class Config:
        from_attributes = True

# ----------------- VEHICLE SCHEMAS (FREE FOR DRIVERS) -----------------

class VehicleCreateRequest(BaseModel):
    vehicle_type: str = "Curtain-sided truck"
    make: str = "Volvo"
    model: Optional[str] = "FH 500"
    plate_number: str
    max_weight_tons: float = 22.0
    max_volume_m3: float = 90.0
    trailer_type: Optional[str] = "Standard Semi-trailer"
    current_country: str = "Uzbekistan"
    current_city: str = "Tashkent"
    current_lat: Optional[float] = None
    current_lon: Optional[float] = None
    preferred_destinations: Optional[str] = "Kazakhstan, Russia, Turkey"
    has_adr: bool = False
    has_temperature_control: bool = False
    temp_min: Optional[float] = None
    temp_max: Optional[float] = None

class VehicleResponse(BaseModel):
    id: str
    owner_id: str
    vehicle_type: str
    make: str
    model: Optional[str]
    plate_number: str
    max_weight_tons: float
    max_volume_m3: float
    current_country: str
    current_city: str
    preferred_destinations: Optional[str]
    is_available: bool
    has_adr: bool
    has_temperature_control: bool
    verification_status: str
    created_at: datetime
    owner: Optional[dict] = None

    class Config:
        from_attributes = True

# ----------------- OFFER SCHEMAS -----------------

class OfferCreateRequest(BaseModel):
    load_id: str
    vehicle_id: Optional[str] = None
    proposed_price: float
    currency: str = "USD"
    pickup_date: datetime
    delivery_date: Optional[datetime] = None
    comment: Optional[str] = None

class OfferResponse(BaseModel):
    id: str
    load_id: str
    driver_id: str
    vehicle_id: Optional[str]
    proposed_price: float
    currency: str
    pickup_date: datetime
    delivery_date: Optional[datetime]
    comment: Optional[str]
    status: str
    created_at: datetime
    driver: Optional[dict] = None
    vehicle: Optional[dict] = None

    class Config:
        from_attributes = True

# ----------------- SUBSCRIPTION SCHEMAS -----------------

class SubscriptionPlanResponse(BaseModel):
    id: str
    code: str
    name: str
    price_uzs: float
    active_loads_limit: int
    max_team_members: int
    advanced_search: bool
    analytics_enabled: bool
    priority_support: bool
    api_access: bool

    class Config:
        from_attributes = True

class SubscribeRequest(BaseModel):
    plan_code: str # START, STANDARD, BUSINESS, ENTERPRISE
    payment_method: str = "DEMO_TEST_GATEWAY" # Test adapter
