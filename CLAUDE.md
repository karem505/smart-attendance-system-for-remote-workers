# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Attention Monitor - A webcam-based attention detection application that tracks whether the user is looking at their screen using face pose and eye gaze tracking via MediaPipe.

**Two versions available:**
1. **Desktop App** (`attention_detector.py`) - Python/OpenCV standalone application
2. **Web App** (`attention-monitor-web/`) - React frontend + FastAPI backend, deployed on Railway

## Deployed URLs

- **Frontend**: https://attention-frontend-production.up.railway.app
- **Backend API**: https://satisfied-compassion-production.up.railway.app/api
- **Railway Project ID**: `fdf0bca3-0808-4551-8dce-1a59bc318991`

---

## Desktop Application

### Requirements
- Python 3.11 (MediaPipe does not support Python 3.13+)
- Dependencies: opencv-python, mediapipe, numpy

### Commands

```bash
# Run the application
py -3.11 attention_detector.py

# Install dependencies
py -3.11 -m pip install -r requirements.txt

# Build Windows executable
py -3.11 -m PyInstaller --onefile --console --name "AttentionMonitor" --add-data "C:\Users\karm9\AppData\Local\Programs\Python\Python311\Lib\site-packages\mediapipe\modules;mediapipe/modules" attention_detector.py

# Build Mac executable (run on Mac)
./build_mac.sh
```

### Runtime Controls
- Q/ESC: Quit
- R: Reset counters
- P: Pause/Resume
- F/E: Select face/eye threshold
- +/-: Adjust selected threshold

---

## Web Application

### Structure
```
attention-monitor-web/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── components/
│   │   │   ├── AttentionMonitor.jsx
│   │   │   ├── StatsOverlay.jsx
│   │   │   ├── AlertBanner.jsx
│   │   │   └── ThresholdControls.jsx
│   │   ├── hooks/
│   │   │   ├── useAttentionDetector.js  # MediaPipe face mesh logic
│   │   │   └── useAudioAlert.js         # Distraction beep sound
│   │   └── utils/
│   │       └── api.js                   # Backend API client
│   ├── Dockerfile                       # nginx for production
│   └── .env.production
│
└── backend/           # FastAPI + SQLAlchemy
    ├── main.py        # API endpoints
    ├── models.py      # Pydantic/SQLAlchemy models
    ├── database.py    # SQLite database
    ├── Dockerfile
    └── requirements.txt
```

### Frontend Commands
```bash
cd attention-monitor-web/frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Deploy to Railway
railway up
```

### Backend Commands
```bash
cd attention-monitor-web/backend

# Install dependencies
py -3.11 -m pip install -r requirements.txt

# Run development server
py -3.11 -m uvicorn main:app --host 0.0.0.0 --port 8000

# Deploy to Railway
railway up --service satisfied-compassion
```

### Railway Deployment
```bash
# Link to project
railway link -p fdf0bca3-0808-4551-8dce-1a59bc318991

# Deploy frontend
cd frontend && railway up

# Deploy backend
cd backend && railway up --service satisfied-compassion

# Set environment variables
railway variables --set "API_URL=https://satisfied-compassion-production.up.railway.app/api"

# View logs
railway logs
```

### Key Technical Notes

**MediaPipe in Browser:**
- MediaPipe must be loaded via CDN script tags (not npm imports) due to Vite bundling issues
- Scripts loaded dynamically from `cdn.jsdelivr.net/npm/@mediapipe/face_mesh` and `camera_utils`
- Uses `window.FaceMesh` and `window.Camera` global objects

**Camera Access:**
- Requires HTTPS (except localhost)
- Explicit `getUserMedia()` permission request with error handling
- Error states displayed to user with retry option

**Features:**
- Real-time face/eye gaze tracking
- Picture-in-Picture mode for background monitoring
- Audio alerts when distracted (configurable)
- Session statistics stored in backend database

---

## Architecture (Shared)

### Detection Thresholds
- Face direction: 0.31 (adjustable)
- Eye gaze: 0.22 (adjustable)

### Key MediaPipe Landmarks
- Face: nose tip (4), forehead (10), chin (152), cheeks (234, 454)
- Eyes: iris centers (468, 473), eye corners (33, 133, 362, 263)

### Attention Calculation
```javascript
// Face direction
noseOffsetX = (nose.x - faceCenter.x) / faceWidth
faceLooking = Math.abs(noseOffsetX) < 0.31 && Math.abs(noseOffsetY) < 0.31

// Eye gaze
avgGazeX = (Math.abs(leftEyeGazeX) + Math.abs(rightEyeGazeX)) / 2
eyesLooking = avgGazeX < 0.22 && avgGazeY < 0.22

// Combined attention
isAttentive = faceDetected && faceLooking && eyesLooking
```
