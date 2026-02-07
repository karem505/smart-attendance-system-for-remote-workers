#!/bin/bash
# Build script for Mac
# Run this on a Mac computer to create AttentionMonitor.app

echo "Building Attention Monitor for Mac..."
echo "========================================"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3.11 first."
    exit 1
fi

# Install requirements
echo "Installing requirements..."
python3 -m pip install opencv-python mediapipe numpy pyinstaller

# Build the app
echo "Building executable..."
python3 -m PyInstaller --onefile --windowed --name "AttentionMonitor" attention_detector.py

echo ""
echo "========================================"
echo "Build complete!"
echo "The app is located at: dist/AttentionMonitor.app"
echo "You can move it to your Applications folder."
