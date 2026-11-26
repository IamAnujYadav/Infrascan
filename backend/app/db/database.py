"""Database connection (SQLAlchemy). PostgreSQL (Neon) or SQLite."""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


def database_url() -> str:
    """Neon gives 'postgresql://...'. SQLAlchemy needs the driver name: 'postgresql+psycopg://...'."""
    url = settings.database_url.strip().strip('"').strip("'")
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


URL = database_url()
connect_args = {"check_same_thread": False} if URL.startswith("sqlite") else {}

# pool_pre_ping: Neon puts an idle database to sleep and drops the old connections.
# The pool checks a connection before using it, so the first request after a pause still works.
engine = create_engine(URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """One database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create the tables that do not exist yet."""
    from app.db import models  # noqa: F401  (importing it registers the tables)
    Base.metadata.create_all(bind=engine)