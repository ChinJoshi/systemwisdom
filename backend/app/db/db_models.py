import datetime
import uuid
from typing import TypedDict

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class QuestionAnswers(TypedDict):
    """Shape of `Question.answers`: the answer options plus which one is correct."""

    choices: list[str]
    correct_index: int  # index into `choices`


class Codebase(TimestampMixin, Base):
    __tablename__ = "codebases"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # WorkOS user id (e.g. "user_01H..."); users live in WorkOS, so there's no local FK.
    user_id: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255))
    blob_uri: Mapped[str] = mapped_column(Text)


class Concept(TimestampMixin, Base):
    __tablename__ = "concepts"
    __table_args__ = (UniqueConstraint("codebase_id", "name"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    # Lookups by codebase_id are served by the (codebase_id, name) unique index.
    codebase_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("codebases.id"))


class Assessment(TimestampMixin, Base):
    __tablename__ = "assessments"
    __table_args__ = (
        # At most one active assessment per codebase.
        Index(
            "uq_assessments_one_active_per_codebase",
            "codebase_id",
            unique=True,
            postgresql_where=text("active"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    codebase_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("codebases.id"), index=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class Question(TimestampMixin, Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessments.id"), index=True
    )
    concept_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("concepts.id"), index=True)
    question: Mapped[str] = mapped_column(Text)
    answers: Mapped[QuestionAnswers] = mapped_column(JSONB)


class Contributor(TimestampMixin, Base):
    __tablename__ = "contributors"
    __table_args__ = (UniqueConstraint("codebase_id", "email"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # Lookups by codebase_id are served by the (codebase_id, email) unique index.
    codebase_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("codebases.id"))
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(320))


class ContributorUnderstanding(TimestampMixin, Base):
    __tablename__ = "contributor_understandings"
    __table_args__ = (
        UniqueConstraint("contributor_id", "concept_id"),
        CheckConstraint("score BETWEEN 0 AND 100", name="ck_score_0_to_100"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    concept_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("concepts.id"), index=True)
    # Lookups by contributor_id are served by the (contributor_id, concept_id) unique index.
    contributor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contributors.id"))
    score: Mapped[int] = mapped_column(Integer)
