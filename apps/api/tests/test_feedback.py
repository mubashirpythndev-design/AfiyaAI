"""Unit tests for user feedback & healthcare needs survey and admin review."""

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.database import Base, User, UserFeedback
from app.models.schemas import FeedbackCreateRequest
from app.routers.feedback import submit_feedback
from app.routers.admin import list_feedbacks, delete_feedback
from app.services.auth_dependency import get_current_user
from app.services.auth_service import create_access_token


@pytest_asyncio.fixture
async def feedback_db(tmp_path):
    """Isolated in-memory SQLite database with all tables created."""
    db_file = tmp_path / "test_feedback.db"
    db_url = f"sqlite+aiosqlite:///{db_file}"
    engine = create_async_engine(db_url, connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    yield session_factory
    await engine.dispose()


@pytest.mark.asyncio
async def test_submit_feedback_unauthenticated(feedback_db):
    """Any visitor can submit feedback without logging in."""
    req = FeedbackCreateRequest(
        name="Hamza Tariq",
        email="hamza.tariq@example.com",
        age=34,
        city="Lahore",
        primary_need="Find Affordable Medicine Alternatives",
        frequency_of_medicine_purchase="Monthly (Chronic Medication)",
        rating=5,
        ease_of_use="Very Easy",
        feedback="Great initiative for Pakistan! I easily found affordable paracetamol alternatives.",
        would_recommend=True,
    )
    async with feedback_db() as db:
        res = await submit_feedback(body=req, db=db)
        assert res.name == "Hamza Tariq"
        assert res.email == "hamza.tariq@example.com"
        assert res.rating == 5
        assert res.primary_need == "Find Affordable Medicine Alternatives"
        assert res.id is not None
        assert res.user_id is None


@pytest.mark.asyncio
async def test_submit_feedback_authenticated(feedback_db):
    """Logged-in user feedback automatically links user_id."""
    async with feedback_db() as db:
        user = User(
            id="fb_user_1",
            name="Fatima Noor",
            email="fatima.noor@example.com",
            is_verified=True,
        )
        db.add(user)
        await db.commit()

        token = create_access_token(user.id)

        req = FeedbackCreateRequest(
            name="Fatima Noor",
            email="fatima.noor@example.com",
            age=27,
            city="Islamabad",
            primary_need="Scan & Read Doctor's Prescription",
            frequency_of_medicine_purchase="Occasional / As Needed",
            rating=4,
            ease_of_use="Easy",
            feedback="The prescription OCR works really fast and accurate on mobile.",
            would_recommend=True,
        )
        res = await submit_feedback(
            body=req,
            authorization=f"Bearer {token}",
            db=db,
        )
        assert res.user_id == "fb_user_1"
        assert res.rating == 4


@pytest.mark.asyncio
async def test_admin_list_and_filter_feedbacks(feedback_db):
    """Admin can view feedback list and summary metrics with filters, non-admins are 403."""
    async with feedback_db() as db:
        admin_user = User(
            id="admin_fb_user",
            name="Admin User",
            email="admin.fb@afiya.ai",
            is_admin=True,
        )
        reg_user = User(
            id="reg_fb_user",
            name="Regular User",
            email="reg@example.com",
            is_admin=False,
        )
        db.add_all([admin_user, reg_user])
        await db.commit()

        # Seed sample feedbacks
        f1 = UserFeedback(
            name="Ali Khan",
            email="ali@example.com",
            city="Karachi",
            primary_need="Find Affordable Medicine Alternatives",
            rating=5,
            feedback="Saved a lot of money.",
            would_recommend=True,
        )
        f2 = UserFeedback(
            name="Sara Ahmed",
            email="sara@example.com",
            city="Lahore",
            primary_need="Scan & Read Doctor's Prescription",
            rating=4,
            feedback="Prescription OCR is very helpful.",
            would_recommend=True,
        )
        db.add_all([f1, f2])
        await db.commit()

        # 1. Non-admin is forbidden
        with pytest.raises(HTTPException) as exc:
            await list_feedbacks(current_user=reg_user, db=db)
        assert exc.value.status_code == 403

        # 2. Admin list response
        resp = await list_feedbacks(current_user=admin_user, db=db)
        assert resp.summary.total_submissions == 2
        assert resp.summary.average_rating == 4.5
        assert resp.summary.recommend_percentage == 100.0
        assert len(resp.feedbacks) == 2

        # 3. Filtering by search
        search_resp = await list_feedbacks(
            search="Karachi",
            current_user=admin_user,
            db=db,
        )
        assert len(search_resp.feedbacks) == 1
        assert search_resp.feedbacks[0].name == "Ali Khan"

        # 4. Admin deletes feedback
        await delete_feedback(feedback_id=f1.id, current_user=admin_user, db=db)
        after_del = await list_feedbacks(current_user=admin_user, db=db)
        assert after_del.summary.total_submissions == 1
