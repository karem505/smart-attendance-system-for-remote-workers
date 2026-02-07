# Use Python 3.11 slim image
FROM python:3.11-slim

# Run in unbuffered mode
ENV PYTHONUNBUFFERED=1

# Create and change to the app directory
WORKDIR /app

# Copy requirements first for caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Railway will set PORT env var)
EXPOSE 8000

# Run the web service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
