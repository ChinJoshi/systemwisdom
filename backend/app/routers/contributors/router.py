import uuid
from typing import Annotated

from app.api_models import AuthenticatedUser, ContributorResponse
from app.db.db import Session
from app.db.db_models import Contributor
from app.routers.codebase.helpers import get_owned_codebase
from app.security import authenticated_user
from fastapi import APIRouter, Depends
from sqlalchemy import select

router = APIRouter(prefix="/codebases/{codebase_id}/contributors")


@router.get("")
def list_contributors(
    codebase_id: uuid.UUID,
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> list[ContributorResponse]:
    with Session() as session:
        get_owned_codebase(session, codebase_id, user.user_id)
        contributors = session.scalars(
            select(Contributor)
            .where(Contributor.codebase_id == codebase_id)
            .order_by(Contributor.name)
        ).all()
        return [ContributorResponse.model_validate(c) for c in contributors]
