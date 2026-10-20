"""Cabinet fields, source verification and embedding freshness.
Revision: 0010. Local implementation only; run against an explicitly selected DB.
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

FIELDS = {
    "user_cabinet": [sa.Column("dosage_instruction", sa.String(255)), sa.Column("reminder_times", sa.JSON()), sa.Column("monthly_units", sa.Integer())],
    "medicines": [sa.Column("source_verification_status", sa.String(100), nullable=False, server_default="needs_source_verification")],
    "sources": [sa.Column("verification_status", sa.String(100), nullable=False, server_default="needs_source_verification")],
    "embeddings": [sa.Column("content_hash", sa.String(64))],
}

def upgrade():
    for table, columns in FIELDS.items():
        if not sa.inspect(op.get_bind()).has_table(table):
            continue
        present = {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}
        for column in columns:
            if column.name not in present:
                op.add_column(table, column)
    # Old SQLite create_all installations lacked this constraint. Avoid deleting duplicates.
    inspector = sa.inspect(op.get_bind())
    unique = inspector.get_unique_constraints("user_cabinet")
    if not any(set(c["column_names"]) == {"user_id", "medicine_id"} for c in unique):
        duplicates = op.get_bind().execute(sa.text("SELECT COUNT(*) FROM (SELECT user_id, medicine_id FROM user_cabinet GROUP BY user_id, medicine_id HAVING COUNT(*) > 1) AS duplicates")).scalar()
        if duplicates:
            raise RuntimeError("Duplicate cabinet entries require review before adding uniqueness")
        with op.batch_alter_table("user_cabinet") as batch:
            batch.create_unique_constraint("uq_user_medicine", ["user_id", "medicine_id"])

def downgrade():
    for table, columns in reversed(list(FIELDS.items())):
        if not sa.inspect(op.get_bind()).has_table(table):
            continue
        present = {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}
        with op.batch_alter_table(table) as batch:
            for column in reversed(columns):
                if column.name in present:
                    batch.drop_column(column.name)
