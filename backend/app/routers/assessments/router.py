import uuid
from typing import Annotated

from app.api_models import AssessmentResponse, AuthenticatedUser
from app.db.db import Session
from app.db.db_models import Assessment, Question
from app.routers.codebase.helpers import get_owned_codebase
from app.security import authenticated_user
from fastapi import APIRouter, Depends
from sqlalchemy import func, select

router = APIRouter(prefix="/codebases/{codebase_id}/assessments")


@router.get("")
def list_assessments(
    codebase_id: uuid.UUID,
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> list[AssessmentResponse]:
    with Session() as session:
        get_owned_codebase(session, codebase_id, user.user_id)
        question_count = (
            select(func.count(Question.id))
            .where(Question.assessment_id == Assessment.id)
            .correlate(Assessment)
            .scalar_subquery()
        )
        rows = session.execute(
            select(Assessment, question_count)
            .where(Assessment.codebase_id == codebase_id)
            # The active assessment (at most one) first, then the rest newest first.
            .order_by(Assessment.active.desc(), Assessment.created_at.desc())
        ).all()
        return [
            AssessmentResponse(
                id=assessment.id,
                active=assessment.active,
                question_count=count,
                created_at=assessment.created_at,
            )
            for assessment, count in rows
        ]
