"""Model SQLAlchemy (tabel database)."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from extensions import Base


class UserModel(Base):
    __tablename__ = "users"
    id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    role = Column(String(20), nullable=False, default="USER")  # USER | ADMIN | TIKUM_COORDINATOR
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    attendances = relationship("AttendanceModel", back_populates="user", cascade="all, delete-orphan")
    live_positions = relationship("LivePositionModel", back_populates="user", cascade="all, delete-orphan")
    tikum_memberships = relationship("TikumMemberModel", back_populates="user", cascade="all, delete-orphan")
    tikum_messages = relationship("TikumMessageModel", back_populates="user", cascade="all, delete-orphan")


class EventModel(Base):
    __tablename__ = "events"
    id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    tagline = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="DRAFT", index=True)  # DRAFT | PUBLISHED | DONE
    is_featured = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    locations = relationship("LocationModel", back_populates="event", cascade="all, delete-orphan")
    tikums = relationship("TikumModel", back_populates="event", cascade="all, delete-orphan")
    attendances = relationship("AttendanceModel", back_populates="event", cascade="all, delete-orphan")
    live_positions = relationship("LivePositionModel", back_populates="event", cascade="all, delete-orphan")
    tikum_members = relationship("TikumMemberModel", back_populates="event", cascade="all, delete-orphan")


class LocationModel(Base):
    __tablename__ = "locations"
    id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(255), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # START | FINISH
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    time = Column(String(50), nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    event = relationship("EventModel", back_populates="locations")


class TikumModel(Base):
    __tablename__ = "tikums"
    id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(255), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    meet_time = Column(String(50), nullable=True)
    quota = Column(Integer, nullable=True)
    contact = Column(String(255), nullable=True)
    coordinator_user_id = Column(String(255), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    event = relationship("EventModel", back_populates="tikums")
    attendees = relationship("AttendanceModel", back_populates="tikum")
    coordinator = relationship("UserModel", foreign_keys=[coordinator_user_id], backref="coordinated_tikums")
    members = relationship("TikumMemberModel", back_populates="tikum", cascade="all, delete-orphan")
    messages = relationship("TikumMessageModel", back_populates="tikum", cascade="all, delete-orphan")


class AttendanceModel(Base):
    __tablename__ = "attendances"
    id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(255), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tikum_id = Column(String(255), ForeignKey("tikums.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(30), nullable=False, default="ATTENDING")  # ATTENDING | ON_THE_WAY | AT_TIKUM | FINISHED | CANCELLED
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    event = relationship("EventModel", back_populates="attendances")
    user = relationship("UserModel", back_populates="attendances")
    tikum = relationship("TikumModel", back_populates="attendees")


class LivePositionModel(Base):
    __tablename__ = "live_positions"
    id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(255), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    speed = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)
    accuracy = Column(Float, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    event = relationship("EventModel", back_populates="live_positions")
    user = relationship("UserModel", back_populates="live_positions")


class TikumMemberModel(Base):
    __tablename__ = "tikum_members"
    id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(255), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    tikum_id = Column(String(255), ForeignKey("tikums.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    event = relationship("EventModel", back_populates="tikum_members")
    tikum = relationship("TikumModel", back_populates="members")
    user = relationship("UserModel", back_populates="tikum_memberships")


class TikumMessageModel(Base):
    __tablename__ = "tikum_messages"
    id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    tikum_id = Column(String(255), ForeignKey("tikums.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    tikum = relationship("TikumModel", back_populates="messages")
    user = relationship("UserModel", back_populates="tikum_messages")

