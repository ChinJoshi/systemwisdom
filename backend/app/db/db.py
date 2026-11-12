import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = str(os.getenv("DATABASE_URL"))
# an Engine, which the Session will use for connection
# resources
engine = create_engine(DATABASE_URL)

# a sessionmaker(), also in the same scope as the engine
Session = sessionmaker(engine)
