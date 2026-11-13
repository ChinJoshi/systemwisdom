from app.config import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# an Engine, which the Session will use for connection
# resources
engine = create_engine(
    settings.database_url.encoded_string(),
    # Fail fast instead of hanging requests when the database is unreachable
    # (libpq waits indefinitely by default). Value is in seconds.
    connect_args={"connect_timeout": 3},
)

# a sessionmaker(), also in the same scope as the engine
Session = sessionmaker(engine)
