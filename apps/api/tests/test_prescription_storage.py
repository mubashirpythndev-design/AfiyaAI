"""Private attachments survive sessions and cannot leak between buyers."""
import importlib.util
import io
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from PIL import Image

from app.db.database import PrescriptionAttachment
from marketplace_helpers import marketplace, request


def image_bytes() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (8, 8), "white").save(output, format="PNG")
    return output.getvalue()


@pytest.mark.asyncio
async def test_attachment_is_persisted_and_only_owner_or_admin_can_read(marketplace):
    content = image_bytes()
    result = await request(marketplace, "POST", "/api/v1/store/prescriptions",
                           files={"image": ("sample.png", content, "image/png")})
    assert result.status_code == 200
    attachment_id = result.json()["prescription_image_url"].split("/")[-1]
    async with marketplace["sessions"]() as db:
        saved = await db.get(PrescriptionAttachment, attachment_id)
        assert saved.content == content
        assert saved.size_bytes == len(content)
    for role, status in (("buyer", 200), ("admin", 200), ("other", 404), (None, 401)):
        response = await request(marketplace, "GET", f"/api/v1/store/prescriptions/{attachment_id}", role=role)
        assert response.status_code == status
        if status == 200:
            assert response.content == content
            assert response.headers["content-type"] == "image/png"
            assert response.headers["cache-control"] == "private, no-store"
            assert response.headers["x-content-type-options"] == "nosniff"


@pytest.mark.asyncio
async def test_bad_large_and_unauthenticated_uploads_are_rejected(marketplace):
    for role, body, expected in ((None, image_bytes(), 401), ("buyer", b"", 422),
                                 ("buyer", b"<script>bad</script>", 422),
                                 ("buyer", b"x" * (10 * 1024 * 1024 + 1), 413)):
        result = await request(marketplace, "POST", "/api/v1/store/prescriptions", role=role,
                               files={"image": ("pretend.png", body, "image/png")})
        assert result.status_code == expected
    for value in ("invalid", "00000000-0000-0000-0000-000000000000"):
        response = await request(marketplace, "GET", f"/api/v1/store/prescriptions/{value}")
        assert response.status_code == 404


def test_attachment_migration_is_idempotent_and_reversible(tmp_path):
    path = Path(__file__).resolve().parents[1] / "alembic/versions/0013_prescription_attachments.py"
    spec = importlib.util.spec_from_file_location("attachment_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'attachments.db'}")
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE users (id VARCHAR(36) PRIMARY KEY)"))
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
            module.upgrade()
            assert sa.inspect(connection).has_table("prescription_attachments")
            assert sa.inspect(connection).get_indexes("prescription_attachments")[0]["name"] == "ix_prescription_attachments_user_id"
            module.downgrade()
            assert not sa.inspect(connection).has_table("prescription_attachments")
            assert sa.inspect(connection).has_table("users")
    engine.dispose()
