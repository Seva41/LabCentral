"""Create the initial LabCentral 2 schema."""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(40), nullable=False),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("uq_users_single_admin", "users", ["is_admin"], unique=True, postgresql_where=sa.text("is_admin IS TRUE"), sqlite_where=sa.text("is_admin = 1"))
    op.create_table(
        "login_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_digest", sa.String(64), nullable=False),
        sa.Column("csrf_token", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_login_sessions_token_digest", "login_sessions", ["token_digest"], unique=True)
    op.create_index("ix_login_sessions_user_id", "login_sessions", ["user_id"])
    op.create_index("ix_login_sessions_expires_at", "login_sessions", ["expires_at"])
    op.create_table(
        "game_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("join_code", sa.String(12), nullable=False),
        sa.Column("mode", sa.String(12), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True)),
        sa.Column("ends_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_game_events_join_code", "game_events", ["join_code"], unique=True)
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("game_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("join_code", sa.String(12), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("event_id", "name", name="uq_team_event_name"),
    )
    op.create_index("ix_teams_event_id", "teams", ["event_id"])
    op.create_index("ix_teams_join_code", "teams", ["join_code"], unique=True)
    op.create_table(
        "event_participants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("game_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="SET NULL")),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("event_id", "user_id", name="uq_event_participant"),
    )
    op.create_index("ix_event_participants_event_id", "event_participants", ["event_id"])
    op.create_index("ix_event_participants_user_id", "event_participants", ["user_id"])
    op.create_index("ix_event_participants_team_id", "event_participants", ["team_id"])
    op.create_table(
        "challenges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("game_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("flag_digest", sa.String(64), nullable=False),
        sa.Column("scoring_mode", sa.String(12), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("minimum_points", sa.Integer(), nullable=False),
        sa.Column("decay_per_solve", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_challenges_event_id", "challenges", ["event_id"])
    op.create_table(
        "solves",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("game_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("challenge_id", sa.Integer(), sa.ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="SET NULL")),
        sa.Column("solver_key", sa.String(40), nullable=False),
        sa.Column("awarded_points", sa.Integer(), nullable=False),
        sa.Column("solved_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("challenge_id", "solver_key", name="uq_challenge_solver"),
    )
    op.create_index("ix_solves_event_id", "solves", ["event_id"])
    op.create_index("ix_solves_challenge_id", "solves", ["challenge_id"])
    op.create_index("ix_solves_user_id", "solves", ["user_id"])
    op.create_index("ix_solves_team_id", "solves", ["team_id"])
    op.create_index("ix_solves_solved_at", "solves", ["solved_at"])
    op.create_index("ix_solves_event_user", "solves", ["event_id", "user_id"])
    op.create_index("ix_solves_event_team", "solves", ["event_id", "team_id"])
    op.create_table(
        "submission_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("game_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("challenge_id", sa.Integer(), sa.ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("correct", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("attempted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_submission_attempts_event_id", "submission_attempts", ["event_id"])
    op.create_index("ix_submission_attempts_challenge_id", "submission_attempts", ["challenge_id"])
    op.create_index("ix_submission_attempts_user_id", "submission_attempts", ["user_id"])
    op.create_index("ix_submission_attempts_attempted_at", "submission_attempts", ["attempted_at"])
    op.create_index("ix_attempt_user_time", "submission_attempts", ["user_id", "attempted_at"])
    op.create_table(
        "event_checkpoints",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("game_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
    )
    op.create_index("ix_event_checkpoints_event_id", "event_checkpoints", ["event_id"])


def downgrade() -> None:
    op.drop_table("event_checkpoints")
    op.drop_table("submission_attempts")
    op.drop_table("solves")
    op.drop_table("challenges")
    op.drop_table("event_participants")
    op.drop_table("teams")
    op.drop_table("game_events")
    op.drop_table("login_sessions")
    op.drop_table("users")
