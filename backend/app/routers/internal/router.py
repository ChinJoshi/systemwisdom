import logging
import sys
import uuid
from typing import Annotated

from app.api_models import (
    AssessmentWebhook,
    AssessmentWebhookFailed,
    CodebaseResponse,
    CreateCodebaseRequest,
    GeneratedAssessment,
)
from app.db.db import Session
from app.db.db_models import (
    Assessment,
    AssessmentStatus,
    Codebase,
    Concept,
    Contributor,
    Question,
)
from app.security import verified_signature
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

logger = logging.getLogger(__name__)

# Routes called by our own services (not by browsers). Every request must carry a valid signature.
router = APIRouter(prefix="/internal", dependencies=[Depends(verified_signature)])


# Called by the frontend's Vercel Blob upload callback after a codebase zip has finished
# uploading. Idempotent: Vercel Blob may deliver the same callback more than once, so a repeat
# delivery for an existing codebase returns that codebase instead of failing.
@router.post("/codebases", status_code=201)
def create_codebase(body: CreateCodebaseRequest) -> CodebaseResponse:
    with Session() as session:
        session.execute(
            insert(Codebase)
            .values(
                id=body.id,
                user_id=body.user_id,
                name=body.name,
                blob_uri=body.blob_uri,
            )
            .on_conflict_do_nothing(index_elements=[Codebase.id])
        )
        codebase = session.get_one(Codebase, body.id)
        # The id was already taken by a different upload (a replayed id or a UUID collision).
        if codebase.user_id != body.user_id or codebase.blob_uri != body.blob_uri:
            raise HTTPException(status_code=409, detail="Codebase id already in use")
        response = CodebaseResponse.model_validate(codebase)
        session.commit()
        return response


# Called by the eve agent's assessment-webhook hook when its turn settles, with the generated
# assessment or the reason there isn't one. Stores the concepts, contributors, and questions, then
# makes this the codebase's active assessment. Idempotent: the hook retries failed deliveries, so
# a repeat for an assessment that's no longer generating changes nothing.
@router.post("/assessments/{assessment_id}/result", status_code=204)
def record_assessment_result(
    assessment_id: uuid.UUID, body: Annotated[AssessmentWebhook, Body()]
) -> None:
    with Session() as session:
        # Row lock: serializes concurrent deliveries of the same result.
        assessment = session.get(Assessment, assessment_id, with_for_update=True)
        if assessment is None:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if assessment.status != AssessmentStatus.GENERATING:
            return
        if assessment.agent_session_id not in (None, body.session_id):
            raise HTTPException(
                status_code=409, detail="Result is from a different agent session"
            )
        assessment.agent_session_id = body.session_id

        if isinstance(body, AssessmentWebhookFailed):
            logger.warning("Assessment %s failed: %s", assessment_id, body.error)
            assessment.status = AssessmentStatus.FAILED
            assessment.error = body.error
            session.commit()
            return

        try:
            result = GeneratedAssessment.model_validate(body.result)
        except ValidationError as e:
            logger.warning("Assessment %s returned an invalid result: %s", assessment_id, e)
            assessment.status = AssessmentStatus.FAILED
            assessment.error = f"The agent returned an invalid assessment: {e}"[:2000]
            session.commit()
            raise HTTPException(status_code=422, detail="Invalid assessment result")

        codebase_id = assessment.codebase_id
        stored = False
        try:
            # Concepts and contributors belong to the codebase and persist across assessments, so
            # reuse existing rows by their unique (codebase_id, name|email) keys.
            session.execute(
                insert(Concept)
                .values(
                    [{"codebase_id": codebase_id, "name": c.name} for c in result.concepts]
                )
                .on_conflict_do_nothing(index_elements=[Concept.codebase_id, Concept.name])
            )
            # Not dict(result): Result objects have a .keys() method, so dict() would treat them
            # as a mapping and try to subscript them.
            concept_ids = {
                name: concept_id
                for name, concept_id in session.execute(
                    select(Concept.name, Concept.id).where(
                        Concept.codebase_id == codebase_id,
                        Concept.name.in_([c.name for c in result.concepts]),
                    )
                )
            }
            if result.contributors:
                session.execute(
                    insert(Contributor)
                    .values(
                        [
                            {"codebase_id": codebase_id, "name": c.name, "email": c.email}
                            for c in result.contributors
                        ]
                    )
                    .on_conflict_do_nothing(
                        index_elements=[Contributor.codebase_id, Contributor.email]
                    )
                )
            session.add_all(
                Question(
                    assessment_id=assessment_id,
                    concept_id=concept_ids[q.concept],
                    question=q.question,
                    answers={"choices": q.choices, "correct_index": q.correct_index},
                )
                for q in result.questions
            )

            # Retire the previous active assessment first: at most one may be active per codebase.
            session.execute(
                update(Assessment)
                .where(
                    Assessment.codebase_id == codebase_id,
                    Assessment.active,
                    Assessment.id != assessment_id,
                )
                .values(active=False)
            )
            assessment.active = True
            assessment.status = AssessmentStatus.READY
            assessment.error = None
            session.commit()
            stored = True
        finally:
            if not stored:
                # Storing the results failed partway. Discard the partial writes, then record the
                # failure so the assessment doesn't stay "generating" (which blocks new ones). The
                # original exception still propagates; the hook's retry then finds the assessment
                # no longer generating and stops.
                error = sys.exc_info()[1]
                logger.error(
                    "Failed to store results for assessment %s", assessment_id, exc_info=error
                )
                session.rollback()
                session.execute(
                    update(Assessment)
                    .where(
                        Assessment.id == assessment_id,
                        Assessment.status == AssessmentStatus.GENERATING,
                    )
                    .values(
                        status=AssessmentStatus.FAILED,
                        agent_session_id=body.session_id,
                        error=f"Couldn't store the agent's results: {error!r}"[:2000],
                    )
                )
                session.commit()
