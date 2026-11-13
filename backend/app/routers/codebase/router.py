import uuid
from typing import Annotated

from app.api_models import AuthenticatedUser, CodebaseResponse
from app.db.db import Session
from app.db.db_models import Codebase
from app.routers.codebase.helpers import get_owned_codebase
from app.security import authenticated_user
from fastapi import APIRouter, Depends
from sqlalchemy import select

router = APIRouter(prefix="/codebases")


@router.get("")
def list_codebases(
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> list[CodebaseResponse]:
    with Session() as session:
        codebases = session.scalars(
            select(Codebase)
            .where(Codebase.user_id == user.user_id)
            .order_by(Codebase.created_at.desc())
        ).all()
        return [CodebaseResponse.model_validate(c) for c in codebases]


@router.get("/{codebase_id}")
def get_codebase(
    codebase_id: uuid.UUID,
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> CodebaseResponse:
    with Session() as session:
        codebase = get_owned_codebase(session, codebase_id, user.user_id)
        return CodebaseResponse.model_validate(codebase)
