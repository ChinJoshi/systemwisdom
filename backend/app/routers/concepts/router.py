import uuid
from typing import Annotated

from app.api_models import AuthenticatedUser, ConceptResponse
from app.db.db import Session
from app.db.db_models import Assessment, Concept, Question
from app.routers.codebase.helpers import get_owned_codebase
from app.security import authenticated_user
from fastapi import APIRouter, Depends
from sqlalchemy import select

router = APIRouter(prefix="/codebases/{codebase_id}/concepts")


# The concepts covered by the codebase's active assessment. Concept rows persist across
# assessments (older assessments' questions and scores reference them), but each new assessment
# re-derives the concepts, so only the active one's set is current. Empty until an assessment has
# been generated.
@router.get("")
def list_concepts(
    codebase_id: uuid.UUID,
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> list[ConceptResponse]:
    with Session() as session:
        get_owned_codebase(session, codebase_id, user.user_id)
        active_assessment_concepts = (
            select(Question.concept_id)
            .join(Assessment, Question.assessment_id == Assessment.id)
            .where(Assessment.codebase_id == codebase_id, Assessment.active)
        )
        concepts = session.scalars(
            select(Concept)
            .where(Concept.id.in_(active_assessment_concepts))
            .order_by(Concept.name)
        ).all()
        return [ConceptResponse.model_validate(c) for c in concepts]
