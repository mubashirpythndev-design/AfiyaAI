"""Add the marketplace branch after existing revision 0006, without rewriting history."""
from alembic import op
import sqlalchemy as sa

revision = "0007_marketplace_store"
down_revision = "0006"
branch_labels = ("marketplace",)
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    def missing(name: str) -> bool:
        return not sa.inspect(bind).has_table(name)
    def pk() -> sa.Column:
        return sa.Column("id", sa.String(36), primary_key=True)
    if missing("pharmacy_sellers"):
        op.create_table("pharmacy_sellers", pk(),
            sa.Column("pharmacy_name", sa.String(200), nullable=False),
            sa.Column("city", sa.String(100), nullable=False, server_default="Karachi"),
            sa.Column("address", sa.String(300)),
            sa.Column("drug_license_no", sa.String(100), nullable=False, unique=True),
            sa.Column("pharmacist_reg_no", sa.String(100), nullable=False),
            sa.Column("license_doc_url", sa.Text),
            sa.Column("verification_status", sa.String(30), nullable=False, server_default="PENDING"),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.CheckConstraint("verification_status IN ('PENDING','VERIFIED','REJECTED')", name="ck_seller_status"))
    if missing("store_inventory"):
        op.create_table("store_inventory", pk(),
            sa.Column("medicine_id", sa.String(36), sa.ForeignKey("medicines.id"), nullable=False),
            sa.Column("seller_id", sa.String(36), sa.ForeignKey("pharmacy_sellers.id")),
            sa.Column("selling_price", sa.Numeric(10,2), nullable=False),
            sa.Column("stock_quantity", sa.Integer, nullable=False, server_default="50"),
            sa.Column("active_batch_no", sa.String(64), nullable=False, server_default="BATCH-2026-OK"),
            sa.Column("requires_prescription", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("updated_at", sa.DateTime, nullable=False),
            sa.CheckConstraint("selling_price >= 0", name="ck_inventory_price"),
            sa.CheckConstraint("stock_quantity >= 0", name="ck_inventory_stock"))
    if missing("orders"):
        op.create_table("orders", pk(),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("status", sa.String(40), nullable=False),
            sa.Column("prescription_image_url", sa.Text), sa.Column("customer_note", sa.Text),
            sa.Column("has_duplication_override", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("verified_by_pharmacist", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("total_amount", sa.Numeric(10,2), nullable=False, server_default="0.00"),
            sa.Column("total_savings_pkr", sa.Numeric(10,2), nullable=False, server_default="0.00"),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.CheckConstraint("status IN ('AWAITING_PHARMACIST_CART','CART_READY_FOR_USER','PENDING_RX_REVIEW','CONFIRMED','DELIVERED','CANCELLED')", name="ck_order_status"),
            sa.CheckConstraint("total_amount >= 0 AND total_savings_pkr >= 0", name="ck_order_totals"))
    if missing("order_items"):
        op.create_table("order_items", pk(),
            sa.Column("order_id", sa.String(36), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
            sa.Column("medicine_id", sa.String(36), sa.ForeignKey("medicines.id"), nullable=False),
            sa.Column("quantity", sa.Integer, nullable=False),
            sa.Column("unit_price", sa.Numeric(10,2), nullable=False),
            sa.Column("switched_from_medicine_id", sa.String(36)),
            sa.CheckConstraint("quantity > 0", name="ck_order_item_quantity"),
            sa.CheckConstraint("unit_price >= 0", name="ck_order_item_price"))
    for table, column, unique in [("store_inventory","medicine_id",True),("orders","user_id",False),("order_items","order_id",False)]:
        name = f"ix_{table}_{column}"
        if name not in {i["name"] for i in sa.inspect(bind).get_indexes(table)}:
            op.create_index(name, table, [column], unique=unique)


def downgrade() -> None:
    for table in ("order_items","orders","store_inventory","pharmacy_sellers"):
        if sa.inspect(op.get_bind()).has_table(table):
            op.drop_table(table)
