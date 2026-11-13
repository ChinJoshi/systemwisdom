import uuid

from app.db.db_models import Codebase
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as SessionType


# Returns the codebase if it belongs to the user. Raises 404 (not 403) otherwise, so other users'
# codebase ids aren't revealed to exist.
def get_owned_codebase(
    session: SessionType, codebase_id: uuid.UUID, user_id: str
) -> Codebase:
    codebase = session.scalar(
        select(Codebase).where(Codebase.id == codebase_id, Codebase.user_id == user_id)
    )
    if codebase is None:
        raise HTTPException(status_code=404, detail="Codebase not found")
    return codebase
