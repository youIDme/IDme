"""001_initial

Initial database schema for IDme.

Revision ID: 001_initial
Create Date: 2024-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("session_token", sa.String(128), unique=True, nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("onboarding_complete", sa.Boolean(), default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_slug", "users", ["slug"])
    op.create_index("ix_users_session_token", "users", ["session_token"])

    # Verifications table
    op.create_table(
        "verifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("platform_user_id", sa.String(255), nullable=False),
        sa.Column("platform_username", sa.String(255), nullable=False),
        sa.Column("access_token_enc", postgresql.BYTEA(), nullable=True),
        sa.Column("refresh_token_enc", postgresql.BYTEA(), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), default="pending", nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSON(), default=dict),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "platform", name="uq_user_platform"),
    )
    op.create_index("ix_verifications_platform_user", "verifications", ["platform", "platform_user_id"])

    # Profile visits table
    op.create_table(
        "profile_visits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("visitor_ip", sa.String(45), nullable=True),
        sa.Column("visitor_user_agent", sa.String(512), nullable=True),
        sa.Column("referrer", sa.String(512), nullable=True),
        sa.Column("visited_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_profile_visits_user_date", "profile_visits", ["user_id", "visited_at"])

    # OAuth states table (backup for Redis)
    op.create_table(
        "oauth_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("state_token", sa.String(128), unique=True, nullable=False),
        sa.Column("session_token", sa.String(128), nullable=False),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("redirect_after", sa.String(255), nullable=False, server_default="/create"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), default=False, nullable=False),
    )
    op.create_index("ix_oauth_states_state_token", "oauth_states", ["state_token"])


def downgrade() -> None:
    op.drop_table("oauth_states")
    op.drop_table("profile_visits")
    op.drop_table("verifications")
    op.drop_table("users")
