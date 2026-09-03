"""Feedback and community healthcare needs survey router.

Allows any visitor to submit feedback, health needs, and ratings.
Responses are recorded in `user_feedback` and accessible to admins.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import UserFeedback, User, get_db
from app.models.schemas import FeedbackCreateRequest, FeedbackResponseSchema
from app.services.auth_service import decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/feedback", tags=["Feedback"])


@router.post("", response_model=FeedbackResponseSchema, status_code=201)
async def submit_feedback(
    body: FeedbackCreateRequest,
    authorization: Optional[str] = Header(default=None),
    x_clerk_user_email: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> FeedbackResponseSchema:
    """Submit user feedback and healthcare survey response.
    
    Open to all visitors. Automatically associates user_id if authenticated.
    """
    user_id: Optional[str] = None
    auth = authorization if isinstance(authorization, str) else None
    if auth and auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        decoded_id = decode_access_token(token)
        if decoded_id:
            # Check if user exists in DB
            user_res = await db.execute(select(User.id).where(User.id == decoded_id))
            found_id = user_res.scalar_one_or_none()
            if found_id:
                user_id = found_id

    # If not found by token ID, try matching by email
    if not user_id and body.email:
        user_res = await db.execute(select(User.id).where(User.email == str(body.email).lower()))
        user_id = user_res.scalar_one_or_none()

    feedback_obj = UserFeedback(
        user_id=user_id,
        name=body.name.strip(),
        email=str(body.email).lower().strip(),
        age=body.age,
        city=body.city.strip() if body.city else None,
        primary_need=body.primary_need.strip(),
        frequency_of_medicine_purchase=body.frequency_of_medicine_purchase.strip() if body.frequency_of_medicine_purchase else None,
        rating=body.rating,
        ease_of_use=body.ease_of_use.strip() if body.ease_of_use else None,
        feedback=body.feedback.strip(),
        would_recommend=body.would_recommend,
    )

    db.add(feedback_obj)
    await db.commit()
    await db.refresh(feedback_obj)

    logger.info(f"Feedback submitted by {feedback_obj.name} ({feedback_obj.email}) - Rating: {feedback_obj.rating}/5")

    return FeedbackResponseSchema(
        id=feedback_obj.id,
        user_id=feedback_obj.user_id,
        name=feedback_obj.name,
        email=feedback_obj.email,
        age=feedback_obj.age,
        city=feedback_obj.city,
        primary_need=feedback_obj.primary_need,
        frequency_of_medicine_purchase=feedback_obj.frequency_of_medicine_purchase,
        rating=feedback_obj.rating,
        ease_of_use=feedback_obj.ease_of_use,
        feedback=feedback_obj.feedback,
        would_recommend=feedback_obj.would_recommend,
        created_at=feedback_obj.created_at,
    )
