import datetime
import logging
import uuid
from typing import Annotated, Any

import httpx
from app.api_models import AssessmentResponse, AuthenticatedUser, GeneratedAssessment
from app.config import settings
from app.db.db import Session
from app.db.db_models import Assessment, AssessmentStatus, Question
from app.routers.codebase.helpers import get_owned_codebase
from app.security import authenticated_user
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select, update

router = APIRouter(prefix="/codebases/{codebase_id}/assessments")

# A generation still running after this long is assumed lost (e.g. its webhook never arrived), so
# it stops blocking a new assessment for the codebase.
GENERATION_TIMEOUT = datetime.timedelta(hours=1)


# --- eve agent client ---------------------------------------------------------------------------
# The agent (agent/ at the repo root) is served by this deployment at /eve/v1/*.

logger = logging.getLogger(__name__)


class AgentError(Exception):
    pass


def _inline_refs(schema: dict[str, Any]) -> dict[str, Any]:
    """Inline Pydantic's `$defs`/`$ref`s, since not every model provider accepts references in a
    structured-output schema. GeneratedAssessment has no recursive models, so this terminates."""
    defs = schema.pop("$defs", {})

    def resolve(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                return resolve(defs[node["$ref"].removeprefix("#/$defs/")])
            return {key: resolve(value) for key, value in node.items()}
        if isinstance(node, list):
            return [resolve(item) for item in node]
        return node

    return resolve(schema)


ASSESSMENT_OUTPUT_SCHEMA = _inline_refs(GeneratedAssessment.model_json_schema())


def start_assessment_session(
    assessment_id: uuid.UUID, blob_uri: str, oidc_token: str | None
) -> str:
    """Starts an eve session that generates the assessment, and returns its session id.

    The agent works asynchronously and reports back through the HMAC-signed webhook at
    POST /api/internal/assessments/{assessment_id}/result.

    `oidc_token` is this function invocation's Vercel OIDC token (the `x-vercel-oidc-token`
    request header). The agent's channel accepts tokens issued to this project. Under
    `vercel dev`, the agent admits local requests without one.
    """
    base_url = settings.public_url
    body = {
        "message": (
            "Create the assessment for this codebase.\n\n"
            f"Codebase blob URI: {blob_uri}"
        ),
        # Recorded in session state by agent/channels/eve.ts and kept out of the model's context.
        "clientContext": {
            "assessmentId": str(assessment_id),
            "blobUri": blob_uri,
            "callbackUrl": f"{base_url}/api/internal/assessments/{assessment_id}/result",
        },
        "outputSchema": ASSESSMENT_OUTPUT_SCHEMA,
        # Makes a retried request return the same session instead of starting a second run.
        "operationId": f"assessment-{assessment_id}",
    }
    headers = {}
    if oidc_token:
        headers["Authorization"] = f"Bearer {oidc_token}"
    if settings.vercel_automation_bypass_secret:
        headers["x-vercel-protection-bypass"] = (
            settings.vercel_automation_bypass_secret.get_secret_value()
        )

    try:
        response = httpx.post(
            f"{base_url}/eve/v1/session", json=body, headers=headers, timeout=30
        )
        response.raise_for_status()
        return response.json()["sessionId"]
    except (httpx.HTTPError, KeyError, ValueError) as e:
        detail = e.response.text[:500] if isinstance(e, httpx.HTTPStatusError) else ""
        logger.error("Failed to start the assessment agent session: %s %s", e, detail)
        raise AgentError("Couldn't start the assessment agent") from e


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
                status=AssessmentStatus(assessment.status),
                question_count=count,
                created_at=assessment.created_at,
            )
            for assessment, count in rows
        ]


# Starts generating a new assessment for the codebase. The eve agent explores the codebase and
# reports back through POST /api/internal/assessments/{id}/result, which stores the questions and
# makes this the codebase's active assessment. Until then it's listed with status "generating".
@router.post("", status_code=202)
def create_assessment(
    codebase_id: uuid.UUID,
    request: Request,
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> AssessmentResponse:
    with Session() as session:
        codebase = get_owned_codebase(session, codebase_id, user.user_id)
        blob_uri = codebase.blob_uri

        session.execute(
            update(Assessment)
            .where(
                Assessment.codebase_id == codebase_id,
                Assessment.status == AssessmentStatus.GENERATING,
                Assessment.created_at < func.now() - GENERATION_TIMEOUT,
            )
            .values(
                status=AssessmentStatus.FAILED,
                error="Timed out waiting for the agent's results.",
            )
        )
        # One generation per codebase at a time.
        in_progress = session.scalar(
            select(Assessment.id).where(
                Assessment.codebase_id == codebase_id,
                Assessment.status == AssessmentStatus.GENERATING,
            )
        )
        if in_progress is not None:
            raise HTTPException(
                status_code=409,
                detail="An assessment is already being generated for this codebase",
            )
        # Inactive until its questions exist, so the current active assessment stays in place.
        assessment = Assessment(
            codebase_id=codebase_id, active=False, status=AssessmentStatus.GENERATING
        )
        session.add(assessment)
        session.commit()
        assessment_id = assessment.id
        created_at = assessment.created_at

    try:
        # Forward this invocation's Vercel OIDC token so the agent's channel admits the request.
        agent_session_id = start_assessment_session(
            assessment_id, blob_uri, request.headers.get("x-vercel-oidc-token")
        )
    except AgentError as e:
        with Session() as session:
            session.execute(
                update(Assessment)
                .where(Assessment.id == assessment_id)
                .values(status=AssessmentStatus.FAILED, error=str(e))
            )
            session.commit()
        raise HTTPException(status_code=502, detail=str(e))

    with Session() as session:
        session.execute(
            update(Assessment)
            .where(Assessment.id == assessment_id)
            .values(agent_session_id=agent_session_id)
        )
        session.commit()

    return AssessmentResponse(
        id=assessment_id,
        active=False,
        status=AssessmentStatus.GENERATING,
        question_count=0,
        created_at=created_at,
    )


# Closes an assessment so contributors can no longer take it: its public link stops accepting
# answers (410), and its concepts leave the codebase page. Scores already recorded are kept.
# Closing is permanent. Closing an already closed assessment changes nothing.
@router.post("/{assessment_id}/close")
def close_assessment(
    codebase_id: uuid.UUID,
    assessment_id: uuid.UUID,
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> AssessmentResponse:
    with Session() as session:
        get_owned_codebase(session, codebase_id, user.user_id)
        assessment = session.scalar(
            select(Assessment).where(
                Assessment.id == assessment_id, Assessment.codebase_id == codebase_id
            )
        )
        if assessment is None:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if assessment.status != AssessmentStatus.READY:
            raise HTTPException(
                status_code=409, detail="Only a generated assessment can be closed"
            )
        assessment.active = False
        question_count = session.scalar(
            select(func.count(Question.id)).where(Question.assessment_id == assessment_id)
        )
        response = AssessmentResponse(
            id=assessment.id,
            active=False,
            status=AssessmentStatus(assessment.status),
            question_count=question_count or 0,
            created_at=assessment.created_at,
        )
        session.commit()
        return response
