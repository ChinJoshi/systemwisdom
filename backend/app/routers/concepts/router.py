import uuid
from typing import Annotated

from app.api_models import AuthenticatedUser, ConceptResponse
from app.db.db import Session
from app.db.db_models import Concept
from app.routers.codebase.helpers import get_owned_codebase
from app.security import authenticated_user
from fastapi import APIRouter, Depends
from sqlalchemy import select

router = APIRouter(prefix="/codebases/{codebase_id}/concepts")


@router.get("")
def list_concepts(
    codebase_id: uuid.UUID,
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> list[ConceptResponse]:
    with Session() as session:
        get_owned_codebase(session, codebase_id, user.user_id)
        concepts = session.scalars(
            select(Concept)
            .where(Concept.codebase_id == codebase_id)
            .order_by(Concept.name)
        ).all()
        return [ConceptResponse.model_validate(c) for c in concepts]
