# Attention Monitor Web App

A web-based attention monitoring application that uses your webcam to track whether you're paying attention to your screen. Uses face detection and eye gaze tracking via MediaPipe.

## Features

- Real-time face and eye tracking in the browser
- Attention percentage tracking over time
- Visual alerts when distracted for more than 5 seconds
- Adjustable detection thresholds
- Session history stored in database
- Deployable to cloud services

## Tech Stack

- **Frontend**: React + Vite + MediaPipe JavaScript
- **Backend**: Python FastAPI + SQLAlchemy
- **Database**: SQLite (dev) / PostgreSQL (prod)

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- A webcam

### Run Locally

1. **Start the backend**:
```bash
cd backend
pip install -r requirements.txt
python main.py
```

2. **Start the frontend** (in a new terminal):
```bash
cd frontend
npm install
npm run dev
```

3. Open http://localhost:3000 in your browser

4. Allow camera access when prompted

## Configuration

### Detection Thresholds

- **Face Threshold** (default: 0.31): How far your nose can be off-center before being considered "looking away"
- **Eye Threshold** (default: 0.22): How far your iris can be from eye center before being considered "looking away"

Use the sliders in the app to adjust these in real-time.

## Deployment

### Frontend (Vercel)

1. Push your code to GitHub
2. Import the `frontend` folder in Vercel
3. Set the `VITE_API_URL` environment variable to your backend URL
4. Deploy

### Backend (Railway)

1. Push your code to GitHub
2. Create a new project in Railway
3. Deploy the `backend` folder
4. Add a PostgreSQL database
5. Railway will auto-detect the Dockerfile

### Environment Variables

**Frontend (.env)**:
```
VITE_API_URL=https://your-backend.railway.app
```

**Backend**:
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/sessions | Create new session |
| GET | /api/sessions | List recent sessions |
| GET | /api/sessions/:id | Get session details |
| PUT | /api/sessions/:id | Update session stats |
| POST | /api/sessions/:id/end | End a session |

## How It Works

1. **Face Detection**: MediaPipe Face Mesh detects 468 facial landmarks
2. **Face Direction**: Compares nose position to face center to determine if looking at screen
3. **Eye Gaze**: Tracks iris position within eye bounds (requires `refineLandmarks: true`)
4. **Attention State**: Combined face + eye detection with hysteresis to prevent flickering
5. **Timing**: Tracks total session time and cumulative attention time

## Browser Compatibility

- Chrome 90+ (recommended)
- Firefox 88+
- Edge 90+
- Safari 15+

Note: Requires HTTPS in production for camera access.

## License

MIT
