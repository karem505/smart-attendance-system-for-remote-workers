import React, { useRef, useEffect, useState } from 'react'
import useAttentionDetector from '../hooks/useAttentionDetector'
import AlertBanner from './AlertBanner'

const DISTRACTION_ALERT_DELAY = 5.0 // seconds

function AttentionMonitor({ isPaused, thresholds, onStatsUpdate, stats }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const pipVideoRef = useRef(null)
  const [isPiPActive, setIsPiPActive] = useState(false)
  const sessionStartRef = useRef(Date.now())
  const attentionTimeRef = useRef(0)
  const lastUpdateRef = useRef(Date.now())
  const distractionStartRef = useRef(null)
  const detectionStateRef = useRef(null)

  const { detectionState, isLoading, error, retry } = useAttentionDetector(
    videoRef,
    canvasRef,
    thresholds,
    isPaused
  )

  // Keep detection state ref updated
  useEffect(() => {
    detectionStateRef.current = detectionState
  }, [detectionState])

  // Update timers - runs independently
  useEffect(() => {
    if (isPaused) return

    const interval = setInterval(() => {
      const state = detectionStateRef.current
      if (!state) return

      const now = Date.now()
      const elapsed = (now - lastUpdateRef.current) / 1000

      // Update attention time
      if (state.isAttentive) {
        attentionTimeRef.current += elapsed
        distractionStartRef.current = null
      } else {
        if (distractionStartRef.current === null) {
          distractionStartRef.current = now
        }
      }

      lastUpdateRef.current = now

      const sessionTime = (now - sessionStartRef.current) / 1000
      const distractionDuration = distractionStartRef.current
        ? (now - distractionStartRef.current) / 1000
        : 0
      const attentionPercentage = sessionTime > 0
        ? (attentionTimeRef.current / sessionTime) * 100
        : 100

      onStatsUpdate({
        isAttentive: state.isAttentive,
        faceDetected: state.faceDetected,
        faceLooking: state.faceLooking,
        eyesLooking: state.eyesLooking,
        sessionTime,
        attentionTime: attentionTimeRef.current,
        attentionPercentage,
        distractionDuration,
        noseOffsetX: state.noseOffsetX,
        noseOffsetY: state.noseOffsetY,
        avgEyeGazeX: state.avgEyeGazeX,
        avgEyeGazeY: state.avgEyeGazeY
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isPaused, onStatsUpdate])

  // Reset handler
  useEffect(() => {
    if (stats.sessionTime === 0 && stats.attentionTime === 0) {
      sessionStartRef.current = Date.now()
      attentionTimeRef.current = 0
      lastUpdateRef.current = Date.now()
      distractionStartRef.current = null
    }
  }, [stats.sessionTime, stats.attentionTime])

  const showAlert = stats.distractionDuration >= DISTRACTION_ALERT_DELAY

  // Stream canvas to PiP video element
  useEffect(() => {
    if (!canvasRef.current || !pipVideoRef.current) return

    try {
      const stream = canvasRef.current.captureStream(30)
      pipVideoRef.current.srcObject = stream
    } catch (err) {
      console.log('Canvas capture not supported')
    }
  }, [isLoading])

  // Handle PiP mode
  const togglePiP = async () => {
    if (!pipVideoRef.current) return

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
        setIsPiPActive(false)
      } else if (document.pictureInPictureEnabled) {
        await pipVideoRef.current.requestPictureInPicture()
        setIsPiPActive(true)
      }
    } catch (err) {
      console.error('PiP error:', err)
    }
  }

  // Listen for PiP exit
  useEffect(() => {
    const handlePiPExit = () => setIsPiPActive(false)

    if (pipVideoRef.current) {
      pipVideoRef.current.addEventListener('leavepictureinpicture', handlePiPExit)
    }

    return () => {
      if (pipVideoRef.current) {
        pipVideoRef.current.removeEventListener('leavepictureinpicture', handlePiPExit)
      }
    }
  }, [])

  return (
    <div className="video-container">
      {isLoading && !error && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p className="loading-text">Initializing camera...</p>
        </div>
      )}

      {error && (
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3 className="error-title">Camera Access Error</h3>
          <p className="error-message">{error}</p>
          <button className="error-retry-btn" onClick={retry}>
            Retry
          </button>
          <p className="error-help">
            If the problem persists, check your browser settings and ensure camera permissions are granted.
          </p>
        </div>
      )}

      <video
        ref={videoRef}
        className="webcam"
        style={{ display: 'none' }}
        autoPlay
        playsInline
        muted
      />

      <canvas
        ref={canvasRef}
        className="canvas-overlay"
        width={640}
        height={480}
        style={{ display: isLoading ? 'none' : 'block' }}
      />

      <div
        className={`border-overlay ${stats.isAttentive ? 'attentive' : 'distracted'}`}
        style={{ display: isLoading ? 'none' : 'block' }}
      />

      {showAlert && <AlertBanner />}

      {/* Hidden video for PiP */}
      <video
        ref={pipVideoRef}
        style={{ display: 'none' }}
        autoPlay
        playsInline
        muted
      />

      {/* PiP Button */}
      {!isLoading && document.pictureInPictureEnabled && (
        <button className="pip-btn" onClick={togglePiP}>
          {isPiPActive ? 'Exit PiP' : 'Pop Out'}
        </button>
      )}
    </div>
  )
}

export default AttentionMonitor
