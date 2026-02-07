# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend with production env
RUN npm run build

# Stage 2: Python backend with frontend static files
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy backend requirements
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy built frontend to static directory
COPY --from=frontend-builder /frontend/dist ./static

# Expose port
EXPOSE 8000

# Run the app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
