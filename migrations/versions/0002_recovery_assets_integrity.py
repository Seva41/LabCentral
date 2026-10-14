"""Password recovery, challenge assets and integrity signals."""

from alembic import op
import sqlalchemy as sa

revision = "0002_recovery_assets_integrity"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(254), nullable=True))
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_digest", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    op.create_index("ix_password_reset_tokens_token_digest", "password_reset_tokens", ["token_digest"], unique=True)
    op.create_index("ix_password_reset_tokens_expires_at", "password_reset_tokens", ["expires_at"])
    op.create_table(
        "challenge_assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("game_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("challenge_id", sa.Integer(), sa.ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("storage_key", sa.String(80), nullable=False),
        sa.Column("original_name", sa.String(180), nullable=False),
        sa.Column("media_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("storage_key", name="uq_challenge_asset_storage_key"),
    )
    op.create_index("ix_challenge_assets_event_id", "challenge_assets", ["event_id"])
    op.create_index("ix_challenge_assets_challenge_id", "challenge_assets", ["challenge_id"])
    op.create_table(
        "integrity_signals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("game_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(48), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_integrity_signals_event_id", "integrity_signals", ["event_id"])
    op.create_index("ix_integrity_signals_user_id", "integrity_signals", ["user_id"])
    op.create_index("ix_integrity_signals_created_at", "integrity_signals", ["created_at"])
    op.create_index("ix_integrity_event_created", "integrity_signals", ["event_id", "created_at"])


def downgrade() -> None:
    op.drop_table("integrity_signals")
    op.drop_table("challenge_assets")
    op.drop_table("password_reset_tokens")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_column("users", "email")
