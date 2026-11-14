import logging
import uuid
from typing import Annotated

from app.api_models import AuthenticatedUser, CodebaseResponse
from app.db.db import Session
from app.db.db_models import (
    Assessment,
    Codebase,
    Concept,
    Contributor,
    ContributorUnderstanding,
    Question,
)
from app.routers.codebase.helpers import get_owned_codebase
from app.security import authenticated_user
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session as SessionType
from vercel.blob import BlobError
from vercel.blob import sync as blob

logger = logging.getLogger(__name__)

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


# Deletes a codebase's rows children-first, since the foreign keys don't cascade: scores,
# questions, assessments, concepts, contributors, then the codebase. The caller commits.
def delete_codebase_rows(session: SessionType, codebase_id: uuid.UUID) -> None:
    assessment_ids = select(Assessment.id).where(Assessment.codebase_id == codebase_id)
    session.execute(
        delete(ContributorUnderstanding).where(
            or_(
                ContributorUnderstanding.assessment_id.in_(assessment_ids),
                ContributorUnderstanding.contributor_id.in_(
                    select(Contributor.id).where(Contributor.codebase_id == codebase_id)
                ),
                ContributorUnderstanding.concept_id.in_(
                    select(Concept.id).where(Concept.codebase_id == codebase_id)
                ),
            )
        )
    )
    session.execute(delete(Question).where(Question.assessment_id.in_(assessment_ids)))
    session.execute(delete(Assessment).where(Assessment.codebase_id == codebase_id))
    session.execute(delete(Concept).where(Concept.codebase_id == codebase_id))
    session.execute(delete(Contributor).where(Contributor.codebase_id == codebase_id))
    session.execute(delete(Codebase).where(Codebase.id == codebase_id))


# Deletes the codebase, everything recorded about it (assessments, questions, concepts,
# contributors, and scores), and its uploaded zip in Vercel Blob. The rows are only committed once
# the zip is gone, so a failed Blob delete leaves everything in place to retry (deleting an already
# missing blob succeeds). An assessment still generating is deleted too; its agent's result webhook
# then gets a 404 and stops.
@router.delete("/{codebase_id}", status_code=204)
def delete_codebase(
    codebase_id: uuid.UUID,
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> None:
    with Session() as session:
        codebase = get_owned_codebase(session, codebase_id, user.user_id)
        blob_uri = codebase.blob_uri
        delete_codebase_rows(session, codebase_id)
        try:
            blob.delete_blob(blob_uri)
        except BlobError:
            logger.exception("Failed to delete the upload of codebase %s", codebase_id)
            session.rollback()
            raise HTTPException(
                status_code=502, detail="Couldn't delete the codebase's upload. Try again."
            )
        session.commit()
