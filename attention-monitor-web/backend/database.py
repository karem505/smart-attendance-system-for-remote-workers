import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base

# Use SQLite for local development, PostgreSQL for production
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./attention_monitor.db")

# Handle PostgreSQL URL from Railway/Render (postgres:// -> postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs check_same_thread=False for FastAPI
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for FastAPI routes"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
