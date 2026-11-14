import uuid
from collections import defaultdict
from decimal import Decimal

from app.api_models import (
    AssessmentContributorOption,
    AssessmentQuestion,
    AssessmentSubmission,
    AssessmentSubmissionResponse,
    ConceptScore,
    ExistingContributorIdentity,
    TakeAssessmentResponse,
)
from app.db.db import Session
from app.db.db_models import (
    Assessment,
    AssessmentStatus,
    Codebase,
    Concept,
    Contributor,
    ContributorUnderstanding,
    Question,
)
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session as SessionType

# Public routes for taking an assessment. They're intentionally unauthenticated: the codebase owner
# shares the assessment's link with contributors, who usually have no account, and the
# unguessable assessment id is what grants access. Never return correct answers from here.
router = APIRouter(prefix="/assessments/{assessment_id}")


# Returns the assessment if it can be taken: it must be generated and be the codebase's active one.
# Missing and not-yet-ready assessments are both 404, so ids can't be probed for their state.
def get_takeable_assessment(session: SessionType, assessment_id: uuid.UUID) -> Assessment:
    assessment = session.get(Assessment, assessment_id)
    if assessment is None or assessment.status != AssessmentStatus.READY:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not assessment.active:
        # Closed manually or replaced by a newer assessment.
        raise HTTPException(status_code=410, detail="This assessment is closed")
    return assessment


def load_questions(
    session: SessionType, assessment_id: uuid.UUID
) -> list[tuple[Question, Concept]]:
    return [
        (question, concept)
        for question, concept in session.execute(
            select(Question, Concept)
            .join(Concept, Question.concept_id == Concept.id)
            .where(Question.assessment_id == assessment_id)
            .order_by(Concept.name, Question.created_at, Question.id)
        )
    ]


@router.get("")
def get_assessment_to_take(assessment_id: uuid.UUID) -> TakeAssessmentResponse:
    with Session() as session:
        assessment = get_takeable_assessment(session, assessment_id)
        codebase = session.get_one(Codebase, assessment.codebase_id)
        contributors = session.scalars(
            select(Contributor)
            .where(Contributor.codebase_id == assessment.codebase_id)
            .order_by(Contributor.name, Contributor.email)
        ).all()
        return TakeAssessmentResponse(
            id=assessment.id,
            codebase_name=codebase.name,
            questions=[
                AssessmentQuestion(
                    id=question.id,
                    concept=concept.name,
                    question=question.question,
                    choices=question.answers["choices"],
                )
                for question, concept in load_questions(session, assessment_id)
            ],
            contributors=[AssessmentContributorOption.model_validate(c) for c in contributors],
        )


# Grades a contributor's answers and records a 0-100 understanding score per concept: the share of
# that concept's questions they got right. Scores are recorded against this assessment: retaking it
# replaces them, while scores from earlier assessments stay as they were.
@router.post("/submissions", status_code=201)
def submit_assessment(
    assessment_id: uuid.UUID, body: AssessmentSubmission
) -> AssessmentSubmissionResponse:
    with Session() as session:
        assessment = get_takeable_assessment(session, assessment_id)
        codebase_id = assessment.codebase_id
        questions = load_questions(session, assessment_id)

        # Every question answered exactly once, and only this assessment's questions.
        answers = {answer.question_id: answer.choice_index for answer in body.answers}
        if len(answers) != len(body.answers):
            raise HTTPException(status_code=422, detail="Each question can only be answered once")
        if set(answers) != {question.id for question, _ in questions}:
            raise HTTPException(
                status_code=422, detail="Answer every question in the assessment"
            )

        if isinstance(body.contributor, ExistingContributorIdentity):
            contributor = session.get(Contributor, body.contributor.contributor_id)
            if contributor is None or contributor.codebase_id != codebase_id:
                raise HTTPException(status_code=422, detail="Unknown contributor")
        else:
            # Someone not in the list. If their email is already known for this codebase, they're
            # that contributor (keep the recorded name); otherwise add them.
            session.execute(
                insert(Contributor)
                .values(
                    codebase_id=codebase_id,
                    name=body.contributor.name,
                    email=body.contributor.email,
                )
                .on_conflict_do_nothing(
                    index_elements=[Contributor.codebase_id, Contributor.email]
                )
            )
            contributor = session.scalars(
                select(Contributor).where(
                    Contributor.codebase_id == codebase_id,
                    Contributor.email == body.contributor.email,
                )
            ).one()

        # Grade per concept.
        correct: dict[uuid.UUID, int] = defaultdict(int)
        total: dict[uuid.UUID, int] = defaultdict(int)
        concept_names: dict[uuid.UUID, str] = {}
        for question, concept in questions:
            concept_names[concept.id] = concept.name
            total[concept.id] += 1
            if answers[question.id] == question.answers["correct_index"]:
                correct[concept.id] += 1
        scores = {
            concept_id: (Decimal(correct[concept_id] * 100) / Decimal(total[concept_id])).quantize(
                Decimal("0.01")
            )
            for concept_id in total
        }

        statement = insert(ContributorUnderstanding).values(
            [
                {
                    "contributor_id": contributor.id,
                    "assessment_id": assessment_id,
                    "concept_id": concept_id,
                    "score": score,
                }
                for concept_id, score in scores.items()
            ]
        )
        session.execute(
            statement.on_conflict_do_update(
                index_elements=[
                    ContributorUnderstanding.contributor_id,
                    ContributorUnderstanding.assessment_id,
                    ContributorUnderstanding.concept_id,
                ],
                set_={"score": statement.excluded.score},
            )
        )
        response = AssessmentSubmissionResponse(
            contributor_name=contributor.name,
            scores=[
                ConceptScore(
                    concept=concept_names[concept_id],
                    correct=correct[concept_id],
                    total=total[concept_id],
                    score=float(scores[concept_id]),
                )
                for concept_id in sorted(total, key=lambda c: concept_names[c])
            ],
        )
        session.commit()
        return response
