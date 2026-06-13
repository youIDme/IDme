"""
IDme — SQLAlchemy ORM Models

Tables:
- users: Core identity records with slugs and session tokens
- verifications: Platform-specific OAuth verification records
- profile_visits: Analytics for profile page views
- oauth_states: Persistent backup for Redis-primary OAuth state
"""

import uuid

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer,
    ForeignKey, UniqueConstraint, Text, JSON, Index,
)
from sqlalchemy.dialects.postgresql import UUID, BYTEA
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Public identity slug: idme.io/{slug}
    slug = Column(String(100), unique=True, nullable=False, index=True)

    # Display name (populated from first verified platform)
    display_name = Column(String(255), nullable=True)

    # Session token for claiming identity during onboarding
    session_token = Column(String(128), unique=True, nullable=False, index=True)

    # State flags
    is_active = Column(Boolean, default=True, nullable=False)
    onboarding_complete = Column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    verifications = relationship(
        "Verification",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    visits = relationship(
        "ProfileVisit",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",
    )


class Verification(Base):
    __tablename__ = "verifications"
    __table_args__ = (
        UniqueConstraint("user_id", "platform", name="uq_user_platform"),
        Index("ix_verifications_platform_user", "platform", "platform_user_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Platform identifier: github, linkedin, facebook, whatsapp
    platform = Column(String(20), nullable=False)
    platform_user_id = Column(String(255), nullable=False)
    platform_username = Column(String(255), nullable=False)

    # OAuth tokens (encrypted at rest via Fernet)
    access_token_enc = Column(BYTEA, nullable=True)
    refresh_token_enc = Column(BYTEA, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Verification state machine: pending → verified | failed | expired
    status = Column(String(20), default="pending", nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    last_checked_at = Column(DateTime(timezone=True), nullable=True)

    # Platform-specific metadata (avatar, bio, follower counts, etc.)
    metadata_json = Column(JSON, default=dict)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User", back_populates="verifications")


class ProfileVisit(Base):
    __tablename__ = "profile_visits"
    __table_args__ = (
        Index("ix_profile_visits_user_date", "user_id", "visited_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    visitor_ip = Column(String(45), nullable=True)
    visitor_user_agent = Column(String(512), nullable=True)
    referrer = Column(String(512), nullable=True)

    visited_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="visits")


class OAuthState(Base):
    """
    Persistent backup for OAuth state tokens.
    Redis is the primary store (fast, TTL-based).
    This table provides recovery if Redis restarts mid-flow.
    """
    __tablename__ = "oauth_states"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    state_token = Column(String(128), unique=True, nullable=False, index=True)

    session_token = Column(String(128), nullable=False)
    platform = Column(String(20), nullable=False)
    redirect_after = Column(String(255), nullable=False, default="/create")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
