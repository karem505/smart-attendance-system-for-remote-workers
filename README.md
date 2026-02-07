# Attention Monitor

A webcam-based attention detection system that tracks whether you're looking at your screen using real-time face pose estimation and eye gaze tracking powered by [MediaPipe](https://mediapipe.dev/).

Built for remote workers and students who want to measure and improve their focus during work sessions.

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Face%20Mesh-FF6F00)
![License](https://img.shields.io/badge/License-MIT-green)

## How It Works

1. **Face Detection** - MediaPipe Face Mesh detects 468+ facial landmarks from your webcam feed
2. **Head Pose Estimation** - Compares nose tip position relative to face center to determine if you're facing the screen
3. **Eye Gaze Tracking** - Tracks iris position within eye boundaries using refined landmark detection
4. **Attention Classification** - Combines face direction + eye gaze with hysteresis filtering to prevent flickering
5. **Alerts & Logging** - Visual/audio alerts when distracted, with session statistics saved for review

## Two Versions

### Desktop Application (`attention_detector.py`)

Standalone Python app using OpenCV — runs locally with no server needed.

- Real-time webcam overlay with landmark visualization
- Color-coded face/eye tracking indicators
- Adjustable thresholds via keyboard
- CSV data logging per session
- Flashing alert banner after 5 seconds of distraction

### Web Application (`attention-monitor-web/`)

React frontend + FastAPI backend — deployable to the cloud.

- Browser-based face/eye tracking via MediaPipe JS
- Picture-in-Picture mode for background monitoring
- Audio beep alerts when distracted
- Session history stored in database
- Responsive UI with real-time stats overlay

## Quick Start

### Desktop

```bash
# Requires Python 3.11 (MediaPipe doesn't support 3.13+)
pip install -r requirements.txt
python attention_detector.py
```

**Controls:** `Q` quit | `R` reset | `P` pause | `F`/`E` select threshold | `+`/`-` adjust

### Web App

```bash
# Backend
cd attention-monitor-web/backend
pip install -r requirements.txt
python main.py
# → API running at http://localhost:8000

# Frontend (new terminal)
cd attention-monitor-web/frontend
npm install
npm run dev
# → App running at http://localhost:3000
```

Allow camera access when prompted. Requires HTTPS in production.

## Project Structure

```
├── attention_detector.py          # Desktop app (Python/OpenCV)
├── requirements.txt               # Desktop dependencies
├── build_mac.sh                   # macOS build script
│
└── attention-monitor-web/
    ├── frontend/                  # React + Vite
    │   ├── src/
    │   │   ├── components/        # UI components
    │   │   ├── hooks/             # MediaPipe detection logic
    │   │   └── utils/             # API client
    │   └── Dockerfile
    │
    └── backend/                   # FastAPI + SQLAlchemy
        ├── main.py                # REST API endpoints
        ├── models.py              # Database models
        ├── database.py            # DB connection
        └── Dockerfile
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions` | Start a new monitoring session |
| `GET` | `/api/sessions` | List recent sessions |
| `GET` | `/api/sessions/:id` | Get session details |
| `PUT` | `/api/sessions/:id` | Update session stats |
| `POST` | `/api/sessions/:id/end` | End a session |

## Detection Thresholds

| Parameter | Default | Description |
|-----------|---------|-------------|
| Face direction | 0.31 | Max nose offset from face center (0-1 scale) |
| Eye gaze | 0.22 | Max iris offset from eye center (0-0.5 scale) |

Both are adjustable in real-time via the UI (web) or keyboard shortcuts (desktop).

## Tech Stack

- **Computer Vision:** MediaPipe Face Mesh (468 landmarks + iris tracking)
- **Desktop:** Python 3.11, OpenCV, NumPy
- **Frontend:** React 18, Vite, MediaPipe JS (CDN)
- **Backend:** FastAPI, SQLAlchemy, SQLite/PostgreSQL
- **Deployment:** Docker, Railway

## License

MIT
