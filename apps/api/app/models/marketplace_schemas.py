"""Deterministic marketplace and duplication request contracts."""
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Language = Literal["en", "ur", "roman_ur"]


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class DuplicationItem(StrictRequest):
    medicine_id: str | None = Field(default=None, min_length=1, max_length=36)
    medicine_query: str | None = Field(default=None, min_length=1, max_length=250)

    @model_validator(mode="after")
    def one_identifier(self) -> "DuplicationItem":
        if bool(self.medicine_id) == bool(self.medicine_query):
            raise ValueError("Provide exactly one medicine_id or medicine_query")
        return self


class DuplicationRequest(StrictRequest):
    items: list[str | DuplicationItem] = Field(min_length=1, max_length=100)
    lang: Language = "en"


class CartItem(StrictRequest):
    medicine_id: str = Field(min_length=1, max_length=36)
    quantity: int = Field(strict=True, gt=0, le=10000)
    switched_from_medicine_id: str | None = Field(default=None, min_length=1, max_length=36)


class CartRequest(StrictRequest):
    items: list[CartItem] = Field(max_length=100)

    @field_validator("items")
    @classmethod
    def unique_items(cls, items: list[CartItem]) -> list[CartItem]:
        if len({item.medicine_id for item in items}) != len(items):
            raise ValueError("Duplicate medicine_id; combine quantities into one item")
        return items


class CartEvaluateRequest(CartRequest):
    prescription_attached: bool = False
    lang: Language = "en"


class CheckoutRequest(CartRequest):
    prescription_image_url: str | None = Field(default=None, min_length=1, max_length=2000)
    customer_note: str | None = Field(default=None, max_length=2000)

    @field_validator("prescription_image_url")
    @classmethod
    def image_reference(cls, value: str | None) -> str | None:
        if value is not None and not (value.startswith("https://") or value.startswith("/uploads/")):
            raise ValueError("Use an HTTPS or /uploads/ prescription image reference")
        return value


class ConciergeRequest(CheckoutRequest):
    items: list[CartItem] = Field(default_factory=list, max_length=0)
    prescription_image_url: str = Field(min_length=1, max_length=2000)


class BuildCartRequest(CartRequest):
    items: list[CartItem] = Field(min_length=1, max_length=100)


class ConfirmCartRequest(StrictRequest):
    items: list[CartItem] | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("items")
    @classmethod
    def unique_items(cls, items: list[CartItem] | None) -> list[CartItem] | None:
        return CartRequest.unique_items(items) if items is not None else None


class InventoryPatch(StrictRequest):
    selling_price: Decimal | None = Field(default=None, ge=0, le=Decimal("99999999.99"), max_digits=10, decimal_places=2)
    stock_quantity: int | None = Field(default=None, strict=True, ge=0, le=10000000)
    active_batch_no: str | None = Field(default=None, min_length=1, max_length=64)
    requires_prescription: bool | None = None

    @model_validator(mode="after")
    def non_null_updates(self) -> "InventoryPatch":
        if not self.model_fields_set or any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Provide at least one non-null inventory update")
        return self


class SellerVerifyRequest(StrictRequest):
    verification_status: Literal["VERIFIED", "REJECTED"]


class CatalogSyncRequest(StrictRequest):
    records: list[dict] = Field(max_length=1000)
    dry_run: bool = True
