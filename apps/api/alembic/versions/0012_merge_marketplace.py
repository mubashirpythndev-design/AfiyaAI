"""Join the additive marketplace branch with the existing local migration head."""
revision = "0012_marketplace_merge"
down_revision = ("0011", "0007_marketplace_store")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
