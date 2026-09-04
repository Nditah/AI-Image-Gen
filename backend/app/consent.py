from __future__ import annotations

from typing import TYPE_CHECKING

from .database import database
from .security import enum_value

if TYPE_CHECKING:
    from prisma.models import PolicyDocument

# Account-level policies that must be accepted (latest effective version) before /generate.
REQUIRED_POLICY_KINDS = (
    "AGE_GATE",
    "ACCEPTABLE_USE",
    "PRIVACY",
    "TERMS_OF_SERVICE",
)

CONSENT_REQUIRED_CODE = "CONSENT_REQUIRED"
CONSENT_REQUIRED_MESSAGE = (
    "Accept the current Age gate, Acceptable use, Privacy, and Terms policies before generating."
)


async def latest_required_policies() -> list[PolicyDocument]:
    """Return the latest effective document for each required policy kind."""
    documents = await database.client.policydocument.find_many(
        where={"kind": {"in": list(REQUIRED_POLICY_KINDS)}},
        order={"effectiveAt": "desc"},
    )
    by_kind: dict[str, PolicyDocument] = {}
    for document in documents:
        kind = enum_value(document.kind)
        if kind not in by_kind:
            by_kind[kind] = document
    return [by_kind[kind] for kind in REQUIRED_POLICY_KINDS if kind in by_kind]


async def missing_required_policies(user_id: str) -> list[PolicyDocument]:
    required = await latest_required_policies()
    if not required:
        return []
    consents = await database.client.userconsent.find_many(
        where={
            "userId": user_id,
            "policyDocumentId": {"in": [document.id for document in required]},
        }
    )
    accepted_ids = {item.policyDocumentId for item in consents}
    return [document for document in required if document.id not in accepted_ids]


async def user_has_required_consents(user_id: str) -> bool:
    required = await latest_required_policies()
    if len(required) < len(REQUIRED_POLICY_KINDS):
        # Fail closed until all four policy kinds are seeded.
        return False
    missing = await missing_required_policies(user_id)
    return not missing
