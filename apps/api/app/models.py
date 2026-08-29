from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AnonymousUser(Base):
    __tablename__ = "anonymous_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    mbti: Mapped[str | None] = mapped_column(String(4), nullable=True)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AnonymousSession(Base):
    __tablename__ = "anonymous_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("anonymous_users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TasteProfile(Base):
    __tablename__ = "taste_profiles"

    user_id: Mapped[str] = mapped_column(ForeignKey("anonymous_users.id"), primary_key=True)
    evidence: Mapped[dict[str, float]] = mapped_column(JSON, default=dict)
    absolute_weight: Mapped[float] = mapped_column(Float, default=0.0)
    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class TeaProfile(Base):
    """User-authored profile settings. Taste evidence remains in its source tables."""

    __tablename__ = "tea_profiles"

    user_id: Mapped[str] = mapped_column(ForeignKey("anonymous_users.id"), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(24), default="一位喝茶的人")
    bio: Mapped[str] = mapped_column(String(80), default="")
    selected_tea_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_feedback_id: Mapped[str | None] = mapped_column(ForeignKey("drink_feedback.id"), nullable=True)
    public_quote: Mapped[str | None] = mapped_column(String(120), nullable=True)
    public_block_ids: Mapped[list[str]] = mapped_column(JSON, default=lambda: ["IDENTITY"])
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ProfileShare(Base):
    """One rotatable unlisted capability URL per anonymous user."""

    __tablename__ = "profile_shares"

    user_id: Mapped[str] = mapped_column(ForeignKey("anonymous_users.id"), primary_key=True)
    public_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class SwipeEvent(Base):
    __tablename__ = "swipe_events"
    __table_args__ = (UniqueConstraint("user_id", "client_event_id", name="uq_swipe_user_client_event"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("anonymous_users.id"), index=True)
    client_event_id: Mapped[str] = mapped_column(String(80))
    card_id: Mapped[str] = mapped_column(String(40))
    tea_id: Mapped[str] = mapped_column(String(80), index=True)
    action: Mapped[str] = mapped_column(String(16))
    weight: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DrinkFeedback(Base):
    __tablename__ = "drink_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("anonymous_users.id"), index=True)
    tea_id: Mapped[str] = mapped_column(String(80), index=True)
    result: Mapped[str] = mapped_column(String(16))
    user_words: Mapped[str | None] = mapped_column(Text, nullable=True)
    normalized_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    infusion_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PassportEntry(Base):
    __tablename__ = "passport_entries"
    __table_args__ = (UniqueConstraint("user_id", "tea_id", name="uq_passport_user_tea"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("anonymous_users.id"), index=True)
    tea_id: Mapped[str] = mapped_column(String(80), index=True)
    saved: Mapped[bool] = mapped_column(Boolean, default=False)
    brewed: Mapped[bool] = mapped_column(Boolean, default=False)
    tasted: Mapped[bool] = mapped_column(Boolean, default=False)
    realm_unlocked: Mapped[bool] = mapped_column(Boolean, default=False)
    favorite_infusion: Mapped[int | None] = mapped_column(Integer, nullable=True)
    user_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    normalized_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    first_drunk_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class VoiceSession(Base):
    __tablename__ = "voice_sessions"
    __table_args__ = (
        Index(
            "uq_voice_sessions_live_user",
            "user_id",
            unique=True,
            sqlite_where=text("status IN ('prepared', 'starting', 'active', 'stopping')"),
            postgresql_where=text("status IN ('prepared', 'starting', 'active', 'stopping')"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("anonymous_users.id"), index=True)
    tea_id: Mapped[str] = mapped_column(String(80))
    mode: Mapped[str] = mapped_column(String(16))
    provider_mode: Mapped[str] = mapped_column(String(24))
    status: Mapped[str] = mapped_column(String(16), default="prepared")
    room_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    task_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    brew_stage: Mapped[str | None] = mapped_column(String(24), nullable=True)
    infusion_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provider_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provider_stopped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completion_request: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    completion_result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    action_lease_token: Mapped[str | None] = mapped_column(String(36), nullable=True)
    action_lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_provider_error_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_provider_request_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class VoiceTurn(Base):
    __tablename__ = "voice_turns"
    __table_args__ = (UniqueConstraint("voice_session_id", "client_turn_id", name="uq_voice_turn_client"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    voice_session_id: Mapped[str] = mapped_column(ForeignKey("voice_sessions.id"), index=True)
    client_turn_id: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(16))
    text: Mapped[str] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RealmProgress(Base):
    __tablename__ = "realm_progress"
    __table_args__ = (UniqueConstraint("user_id", "realm_id", name="uq_realm_progress_user_realm"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("anonymous_users.id"), index=True)
    realm_id: Mapped[str] = mapped_column(String(80), index=True)
    tea_id: Mapped[str] = mapped_column(String(80), index=True)
    current_scene: Mapped[str] = mapped_column(String(40))
    completed_scenes: Mapped[list[str]] = mapped_column(JSON, default=list)
    interaction_mode: Mapped[str | None] = mapped_column(String(24), nullable=True)
    total_elapsed_ms: Mapped[int] = mapped_column(Integer, default=0)
    replay_count: Mapped[int] = mapped_column(Integer, default=0)
    used_taste_words: Mapped[bool] = mapped_column(Boolean, default=False)
    # Raw orientation, microphone and touch samples never leave the browser. These
    # JSON documents only keep the controlled, coarse-grained run summary.
    run_state: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    latest_outcome: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    first_completion_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    reading_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    interactive_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RealmSpecimen(Base):
    __tablename__ = "realm_specimens"
    __table_args__ = (UniqueConstraint("user_id", "realm_id", "specimen_id", name="uq_realm_specimen_user_realm_item"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("anonymous_users.id"), index=True)
    realm_id: Mapped[str] = mapped_column(String(80), index=True)
    tea_id: Mapped[str] = mapped_column(String(80), index=True)
    specimen_id: Mapped[str] = mapped_column(String(80))
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    __table_args__ = (UniqueConstraint("user_id", "client_event_id", name="uq_analytics_user_client_event"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    client_event_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    name: Mapped[str] = mapped_column(String(80), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
