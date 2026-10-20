"""First-party regulated store and pharmacist-assisted cart routes."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import Order, User, get_db
from app.models.marketplace_schemas import CartEvaluateRequest, CheckoutRequest, ConciergeRequest, ConfirmCartRequest
from app.services.auth_dependency import get_current_user
from app.services import store_service
from app.services.store_catalog import load_catalog, catalog_row

router = APIRouter(prefix="/api/v1/store",tags=["Store"])


@router.get("/catalog")
async def catalog(db: AsyncSession = Depends(get_db)) -> list[dict]:
    entries = await load_catalog(db)
    return [catalog_row(entry,entries) for entry in entries.values()]


@router.post("/cart-evaluate")
async def cart_evaluate(req: CartEvaluateRequest, db: AsyncSession = Depends(get_db)) -> dict:
    return await store_service.evaluate_cart(db,req.items,req.prescription_attached,req.lang)


@router.post("/checkout")
async def checkout(req: CheckoutRequest, db: AsyncSession = Depends(get_db),
                   current_user: User = Depends(get_current_user)) -> dict:
    return await store_service.checkout(db,req,current_user)


@router.post("/concierge-rx")
async def concierge_rx(req: ConciergeRequest, db: AsyncSession = Depends(get_db),
                       current_user: User = Depends(get_current_user)) -> dict:
    return await store_service.concierge(db,req,current_user)


@router.get("/my-orders")
async def my_orders(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[dict]:
    orders = list((await db.scalars(select(Order).where(Order.user_id == current_user.id).order_by(Order.created_at.desc(),Order.id))).all())
    return await store_service.order_payloads(db,orders)


@router.post("/my-orders/{order_id}/confirm-cart")
async def confirm_cart(order_id: str, req: ConfirmCartRequest | None = None, db: AsyncSession = Depends(get_db),
                       current_user: User = Depends(get_current_user)) -> dict:
    return await store_service.confirm_cart(db,order_id,current_user,req.items if req else None)
