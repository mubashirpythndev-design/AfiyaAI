"""Add user_feedback table for visitor feedback and healthcare needs survey.

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "user_feedback"


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if not inspector.has_table(TABLE):
        op.create_table(
            TABLE,
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column(
                "user_id",
                sa.String(length=36),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("age", sa.Integer(), nullable=True),
            sa.Column("city", sa.String(length=100), nullable=True),
            sa.Column("primary_need", sa.String(length=150), nullable=False),
            sa.Column("frequency_of_medicine_purchase", sa.String(length=100), nullable=True),
            sa.Column("rating", sa.Integer(), nullable=False, server_default="5"),
            sa.Column("ease_of_use", sa.String(length=50), nullable=True),
            sa.Column("feedback", sa.Text(), nullable=False),
            sa.Column("would_recommend", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("idx_feedback_user", TABLE, ["user_id"])
        op.create_index("idx_feedback_email", TABLE, ["email"])
        op.create_index("idx_feedback_created_at", TABLE, ["created_at"])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    if inspector.has_table(TABLE):
        op.drop_table(TABLE)
