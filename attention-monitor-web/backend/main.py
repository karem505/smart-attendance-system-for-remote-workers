from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import get_db, init_db
from models import (
    SessionModel, AttentionLogModel,
    SessionCreate, SessionUpdate, SessionResponse, SessionDetailResponse,
    AttentionLogCreate
)

app = FastAPI(
    title="Attention Monitor API",
    description="Backend API for the Attention Monitor web application",
    version="1.0.0"
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    """Initialize database on startup"""
    init_db()


@app.get("/")
def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Attention Monitor API"}


@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# Session endpoints
@app.post("/api/sessions", response_model=SessionResponse)
def create_session(db: Session = Depends(get_db)):
    """Start a new attention monitoring session"""
    session = SessionModel(
        start_time=datetime.utcnow(),
        is_active=True
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@app.get("/api/sessions", response_model=list[SessionResponse])
def list_sessions(limit: int = 10, db: Session = Depends(get_db)):
    """List recent sessions"""
    sessions = db.query(SessionModel)\
        .order_by(SessionModel.start_time.desc())\
        .limit(limit)\
        .all()
    return sessions


@app.get("/api/sessions/{session_id}", response_model=SessionDetailResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    """Get session details with logs"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.put("/api/sessions/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: int,
    update: SessionUpdate,
    db: Session = Depends(get_db)
):
    """Update session stats"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if update.total_time is not None:
        session.total_time = update.total_time
    if update.attention_time is not None:
        session.attention_time = update.attention_time
    if update.attention_pct is not None:
        session.attention_pct = update.attention_pct

    # Optionally log attention state
    if update.is_attentive is not None:
        log = AttentionLogModel(
            session_id=session_id,
            is_attentive=update.is_attentive
        )
        db.add(log)

    db.commit()
    db.refresh(session)
    return session


@app.post("/api/sessions/{session_id}/end", response_model=SessionResponse)
def end_session(session_id: int, db: Session = Depends(get_db)):
    """End an active session"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.end_time = datetime.utcnow()
    session.is_active = False
    db.commit()
    db.refresh(session)
    return session


@app.post("/api/sessions/{session_id}/logs")
def add_attention_log(
    session_id: int,
    log_data: AttentionLogCreate,
    db: Session = Depends(get_db)
):
    """Add a detailed attention log entry"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    log = AttentionLogModel(
        session_id=session_id,
        is_attentive=log_data.is_attentive,
        face_detected=log_data.face_detected,
        face_looking=log_data.face_looking,
        eyes_looking=log_data.eyes_looking,
        nose_offset_x=log_data.nose_offset_x,
        nose_offset_y=log_data.nose_offset_y,
        eye_gaze_x=log_data.eye_gaze_x,
        eye_gaze_y=log_data.eye_gaze_y
    )
    db.add(log)
    db.commit()
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
