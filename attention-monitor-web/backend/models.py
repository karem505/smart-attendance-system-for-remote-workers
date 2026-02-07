from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean, ForeignKey, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()


# SQLAlchemy Models
class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    total_time = Column(Float, default=0.0)
    attention_time = Column(Float, default=0.0)
    attention_pct = Column(Float, default=100.0)
    is_active = Column(Boolean, default=True)

    logs = relationship("AttentionLogModel", back_populates="session")


class AttentionLogModel(Base):
    __tablename__ = "attention_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    is_attentive = Column(Boolean)
    face_detected = Column(Boolean, default=False)
    face_looking = Column(Boolean, default=False)
    eyes_looking = Column(Boolean, default=False)
    nose_offset_x = Column(Float, default=0.0)
    nose_offset_y = Column(Float, default=0.0)
    eye_gaze_x = Column(Float, default=0.0)
    eye_gaze_y = Column(Float, default=0.0)

    session = relationship("SessionModel", back_populates="logs")


# Pydantic Models for API
class SessionCreate(BaseModel):
    pass


class SessionUpdate(BaseModel):
    total_time: Optional[float] = None
    attention_time: Optional[float] = None
    attention_pct: Optional[float] = None
    is_attentive: Optional[bool] = None


class AttentionLogCreate(BaseModel):
    is_attentive: bool
    face_detected: bool = False
    face_looking: bool = False
    eyes_looking: bool = False
    nose_offset_x: float = 0.0
    nose_offset_y: float = 0.0
    eye_gaze_x: float = 0.0
    eye_gaze_y: float = 0.0


class AttentionLogResponse(BaseModel):
    id: int
    timestamp: datetime
    is_attentive: bool
    face_detected: bool
    face_looking: bool
    eyes_looking: bool

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    id: int
    start_time: datetime
    end_time: Optional[datetime]
    total_time: float
    attention_time: float
    attention_pct: float
    is_active: bool

    class Config:
        from_attributes = True


class SessionDetailResponse(SessionResponse):
    logs: list[AttentionLogResponse] = []
