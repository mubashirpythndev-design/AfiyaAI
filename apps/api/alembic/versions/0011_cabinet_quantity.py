"""Persist cabinet monthly quantity and selected purchase unit."""
from alembic import op
import sqlalchemy as sa
revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

def upgrade():
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("user_cabinet")}
    if "monthly_quantity" not in columns:
        op.add_column("user_cabinet", sa.Column("monthly_quantity", sa.Integer(), nullable=True))
    if "monthly_quantity_unit" not in columns:
        op.add_column("user_cabinet", sa.Column("monthly_quantity_unit", sa.String(16), nullable=True))

def downgrade():
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("user_cabinet")}
    with op.batch_alter_table("user_cabinet") as batch:
        for name in ["monthly_quantity_unit", "monthly_quantity"]:
            if name in columns:
                batch.drop_column(name)
