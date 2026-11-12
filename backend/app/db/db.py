from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

# an Engine, which the Session will use for connection
# resources
engine = create_engine(settings.database_url.encoded_string())

# a sessionmaker(), also in the same scope as the engine
Session = sessionmaker(engine)
