import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import (
    Column, String, Boolean, Integer, Float, DateTime, ForeignKey, Text, Enum as SQLEnum, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class UserRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    LOGISTIC = "LOGISTIC"
    LOGISTICS_COMPANY_OWNER = "LOGISTICS_COMPANY_OWNER"
    DRIVER = "DRIVER"
    VEHICLE_OWNER = "VEHICLE_OWNER"
    TRANSPORT_COMPANY = "TRANSPORT_COMPANY"

class VerificationStatus(str, Enum):
    UNVERIFIED = "UNVERIFIED"
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"

class LoadStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    NEGOTIATION = "NEGOTIATION"
    ACCEPTED = "ACCEPTED"
    ASSIGNED = "ASSIGNED"
    LOADING = "LOADING"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"

class OfferStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    COUNTER_OFFERED = "COUNTER_OFFERED"
    WITHDRAWN = "WITHDRAWN"

class SubscriptionPlanCode(str, Enum):
    START = "START"
    STANDARD = "STANDARD"
    BUSINESS = "BUSINESS"
    ENTERPRISE = "ENTERPRISE"

class SubscriptionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    PAST_DUE = "PAST_DUE"

class ApplicationStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

# ----------------- LOGISTICS SUBSCRIPTION APPLICATION -----------------

class SubscriptionApplication(Base):
    __tablename__ = "subscription_applications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    company_name = Column(String(128), nullable=False)
    contact_phone = Column(String(32), nullable=False)
    extra_phone = Column(String(32), nullable=True)
    plan_code = Column(String(32), nullable=False) # START, STANDARD, BUSINESS, ENTERPRISE
    payment_method = Column(String(32), default="BANK_TRANSFER") # CLICK, PAYME, BANK_TRANSFER
    comment = Column(Text, nullable=True)
    status = Column(String(32), default=ApplicationStatus.PENDING.value) # PENDING, APPROVED, REJECTED
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    user = relationship("User")

# ----------------- USERS & PROFILES -----------------

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    phone = Column(String(32), unique=True, index=True, nullable=False)
    email = Column(String(128), unique=True, index=True, nullable=True)
    full_name = Column(String(128), nullable=False)
    hashed_password = Column(String(256), nullable=False)
    role = Column(String(32), default=UserRole.DRIVER.value, nullable=False)
    is_active = Column(Boolean, default=True)
    verification_status = Column(String(32), default=VerificationStatus.UNVERIFIED.value)
    avatar_url = Column(String(512), nullable=True)
    preferred_language = Column(String(8), default="uz")
    city = Column(String(64), default="Tashkent")
    country = Column(String(64), default="Uzbekistan")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="owner", uselist=False)
    company_memberships = relationship("CompanyMember", back_populates="user")
    driver_profile = relationship("DriverProfile", back_populates="user", uselist=False)
    vehicles = relationship("Vehicle", foreign_keys="[Vehicle.owner_id]", back_populates="owner")
    created_loads = relationship("Load", back_populates="creator", foreign_keys="[Load.created_by]")
    offers = relationship("LoadOffer", back_populates="driver", foreign_keys="[LoadOffer.driver_id]")
    sent_messages = relationship("Message", back_populates="sender")
    notifications = relationship("Notification", back_populates="user")
    reviews_given = relationship("Review", foreign_keys="[Review.author_id]", back_populates="author")
    reviews_received = relationship("Review", foreign_keys="[Review.target_id]", back_populates="target")

class Company(Base):
    __tablename__ = "companies"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String(128), nullable=False)
    tax_id = Column(String(64), nullable=True)
    registration_number = Column(String(64), nullable=True)
    country = Column(String(64), default="Uzbekistan")
    city = Column(String(64), default="Tashkent")
    address = Column(String(256), nullable=True)
    contact_phone = Column(String(32), nullable=True)
    contact_email = Column(String(128), nullable=True)
    logo_url = Column(String(512), nullable=True)
    verification_status = Column(String(32), default=VerificationStatus.PENDING.value)
    document_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="company")
    members = relationship("CompanyMember", back_populates="company")
    loads = relationship("Load", back_populates="company")
    subscriptions = relationship("Subscription", back_populates="company")

class CompanyMember(Base):
    __tablename__ = "company_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    role_in_company = Column(String(32), default="LOGISTIC")
    permissions_json = Column(Text, default='["LOAD_CREATE", "LOAD_EDIT", "OFFER_MANAGE"]')
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="members")
    user = relationship("User", back_populates="company_memberships")

class DriverProfile(Base):
    __tablename__ = "driver_profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    license_number = Column(String(64), nullable=True)
    license_country = Column(String(64), default="Uzbekistan")
    license_categories = Column(String(64), default="C, E")
    license_document_url = Column(String(512), nullable=True)
    passport_document_url = Column(String(512), nullable=True)
    experience_years = Column(Integer, default=3)
    languages = Column(String(128), default="Uzbek, Russian")
    international_experience = Column(Boolean, default=True)
    verification_status = Column(String(32), default=VerificationStatus.UNVERIFIED.value)
    rating = Column(Float, default=5.0)
    completed_trips = Column(Integer, default=0)
    total_distance_km = Column(Float, default=0.0)
    total_weight_tons = Column(Float, default=0.0)
    countries_visited = Column(Integer, default=3)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="driver_profile")

# ----------------- VEHICLES -----------------

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_driver_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    
    vehicle_type = Column(String(64), nullable=False)
    make = Column(String(64), nullable=False)
    model = Column(String(64), nullable=True)
    year = Column(Integer, default=2021)
    plate_number = Column(String(32), nullable=False, unique=True, index=True)
    tech_passport_number = Column(String(64), nullable=True, unique=True, index=True)
    
    max_weight_tons = Column(Float, nullable=False)
    max_volume_m3 = Column(Float, nullable=False)
    length_m = Column(Float, default=13.6)
    width_m = Column(Float, default=2.45)
    height_m = Column(Float, default=2.7)
    trailer_type = Column(String(64), default="Standard Semi-trailer")
    
    current_country = Column(String(64), default="Uzbekistan")
    current_city = Column(String(64), default="Tashkent")
    current_lat = Column(Float, nullable=True)
    current_lon = Column(Float, nullable=True)
    gps_tracking_enabled = Column(Boolean, default=False)
    preferred_destinations = Column(String(256), nullable=True)
    
    is_available = Column(Boolean, default=True)
    has_adr = Column(Boolean, default=False)
    has_temperature_control = Column(Boolean, default=False)
    temp_min = Column(Float, nullable=True)
    temp_max = Column(Float, nullable=True)
    
    insurance_info = Column(String(128), default="CMR Insurance Active")
    inspection_expiry = Column(DateTime, nullable=True)
    permits_info = Column(String(128), default="TIR Carnet / EUMT Permitted")
    photos_json = Column(Text, default="[]")
    documents_json = Column(Text, default="[]")
    verification_status = Column(String(32), default=VerificationStatus.VERIFIED.value)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_id], back_populates="vehicles")
    assigned_driver = relationship("User", foreign_keys=[assigned_driver_id])
    offers = relationship("LoadOffer", back_populates="vehicle")
    assigned_loads = relationship("Load", back_populates="assigned_vehicle")

# ----------------- LOADS -----------------

class Load(Base):
    __tablename__ = "loads"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_driver_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    assigned_vehicle_id = Column(String(36), ForeignKey("vehicles.id"), nullable=True)
    
    origin_country = Column(String(64), nullable=False)
    origin_city = Column(String(64), nullable=False)
    origin_address = Column(String(256), nullable=True)
    origin_lat = Column(Float, nullable=True)
    origin_lon = Column(Float, nullable=True)

    destination_country = Column(String(64), nullable=False)
    destination_city = Column(String(64), nullable=False)
    destination_address = Column(String(256), nullable=True)
    destination_lat = Column(Float, nullable=True)
    destination_lon = Column(Float, nullable=True)

    loading_date = Column(DateTime, nullable=False)
    delivery_deadline = Column(DateTime, nullable=True)
    actual_delivered_at = Column(DateTime, nullable=True)

    cargo_title = Column(String(128), nullable=False)
    cargo_category = Column(String(64), default="General Cargo")
    weight_kg = Column(Float, nullable=False)
    volume_m3 = Column(Float, nullable=False)
    pallets_count = Column(Integer, default=0)

    required_vehicle_type = Column(String(64), nullable=False)
    requires_temperature = Column(Boolean, default=False)
    temp_min = Column(Float, nullable=True)
    temp_max = Column(Float, nullable=True)
    is_adr = Column(Boolean, default=False)
    adr_class = Column(String(32), nullable=True)
    customs_clearance_info = Column(String(256), nullable=True)

    price = Column(Float, nullable=False)
    currency = Column(String(8), default="USD")
    is_negotiable = Column(Boolean, default=True)
    payment_terms = Column(String(128), default="Direct to Driver / Bank Transfer")
    contact_phone = Column(String(32), nullable=False)
    contact_name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)

    status = Column(String(32), default=LoadStatus.ACTIVE.value)
    is_paused = Column(Boolean, default=False)
    images_json = Column(Text, default="[]")
    documents_json = Column(Text, default="[]")
    views_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company", back_populates="loads")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_loads")
    assigned_driver = relationship("User", foreign_keys=[assigned_driver_id])
    assigned_vehicle = relationship("Vehicle", back_populates="assigned_loads")
    offers = relationship("LoadOffer", back_populates="load", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="load")
    history_logs = relationship("OrderStatusHistory", back_populates="load", cascade="all, delete-orphan")

# ----------------- ORDER STATUS HISTORY LOGS -----------------

class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    load_id = Column(String(36), ForeignKey("loads.id"), nullable=False)
    from_status = Column(String(32), nullable=True)
    to_status = Column(String(32), nullable=False)
    changed_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    comment = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    load = relationship("Load", back_populates="history_logs")
    changed_by = relationship("User")

# ----------------- OFFERS & DIRECT NEGOTIATION -----------------

class LoadOffer(Base):
    __tablename__ = "load_offers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    load_id = Column(String(36), ForeignKey("loads.id"), nullable=False)
    driver_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    vehicle_id = Column(String(36), ForeignKey("vehicles.id"), nullable=True)
    
    proposed_price = Column(Float, nullable=False)
    currency = Column(String(8), default="USD")
    pickup_date = Column(DateTime, nullable=False)
    delivery_date = Column(DateTime, nullable=True)
    comment = Column(Text, nullable=True)
    status = Column(String(32), default=OfferStatus.PENDING.value)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    load = relationship("Load", back_populates="offers")
    driver = relationship("User", foreign_keys=[driver_id], back_populates="offers")
    vehicle = relationship("Vehicle", back_populates="offers")

# ----------------- REVIEWS & RATINGS -----------------

class Review(Base):
    __tablename__ = "reviews"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("loads.id"), nullable=False)
    author_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    target_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("User", foreign_keys=[author_id], back_populates="reviews_given")
    target = relationship("User", foreign_keys=[target_id], back_populates="reviews_received")

# ----------------- REAL-TIME CHAT & MESSAGES -----------------

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    load_id = Column(String(36), ForeignKey("loads.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    load = relationship("Load", back_populates="conversations")
    participants = relationship("ConversationParticipant", back_populates="conversation")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    unread_count = Column(Integer, default=0)
    last_read_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="participants")

class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=True)
    attachment_url = Column(String(512), nullable=True)
    attachment_type = Column(String(32), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")

# ----------------- SUBSCRIPTION & MONETIZATION -----------------

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    code = Column(String(32), unique=True, nullable=False)
    name = Column(String(64), nullable=False)
    price_uzs = Column(Float, nullable=False)
    active_loads_limit = Column(Integer, default=5)
    max_team_members = Column(Integer, default=1)
    advanced_search = Column(Boolean, default=True)
    analytics_enabled = Column(Boolean, default=False)
    priority_support = Column(Boolean, default=False)
    api_access = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    features_json = Column(Text, default="[]")

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False)
    plan_id = Column(String(36), ForeignKey("subscription_plans.id"), nullable=False)
    status = Column(String(32), default=SubscriptionStatus.ACTIVE.value)
    starts_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    auto_renew = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan")
    invoices = relationship("Invoice", back_populates="subscription")

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    subscription_id = Column(String(36), ForeignKey("subscriptions.id"), nullable=False)
    invoice_number = Column(String(64), unique=True, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(8), default="UZS")
    status = Column(String(32), default="PAID")
    payment_method = Column(String(32), default="TEST_PAYMENT_GATEWAY")
    paid_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    subscription = relationship("Subscription", back_populates="invoices")

# ----------------- NOTIFICATIONS & AUDIT -----------------

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(128), nullable=False)
    message = Column(Text, nullable=False)
    event_type = Column(String(64), nullable=False)
    link_url = Column(String(256), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=True)
    action = Column(String(128), nullable=False)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(64), nullable=True)
    details_json = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
