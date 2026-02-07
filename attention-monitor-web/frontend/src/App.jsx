import React, { useState, useEffect } from 'react'
import AttentionMonitor from './components/AttentionMonitor'
import StatsOverlay from './components/StatsOverlay'
import ThresholdControls from './components/ThresholdControls'
import { createSession, updateSession } from './utils/api'
import useAudioAlert from './hooks/useAudioAlert'

function App() {
  const [sessionId, setSessionId] = useState(null)
  const [isPaused, setIsPaused] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [stats, setStats] = useState({
    isAttentive: false,
    faceDetected: false,
    faceLooking: false,
    eyesLooking: false,
    sessionTime: 0,
    attentionTime: 0,
    attentionPercentage: 100,
    distractionDuration: 0,
    noseOffsetX: 0,
    noseOffsetY: 0,
    avgEyeGazeX: 0,
    avgEyeGazeY: 0
  })
  const [thresholds, setThresholds] = useState({
    face: 0.31,
    eye: 0.22
  })

  // Start session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await createSession()
        setSessionId(session.id)
      } catch (err) {
        console.log('Backend not available, running in offline mode')
      }
    }
    initSession()
  }, [])

  // Send updates to backend periodically
  useEffect(() => {
    if (!sessionId || isPaused) return

    const interval = setInterval(async () => {
      try {
        await updateSession(sessionId, {
          total_time: stats.sessionTime,
          attention_time: stats.attentionTime,
          attention_pct: stats.attentionPercentage,
          is_attentive: stats.isAttentive
        })
      } catch (err) {
        // Ignore errors if backend is unavailable
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [sessionId, stats, isPaused])

  const handleReset = () => {
    setStats(prev => ({
      ...prev,
      sessionTime: 0,
      attentionTime: 0,
      attentionPercentage: 100,
      distractionDuration: 0
    }))
  }

  const handleTogglePause = () => {
    setIsPaused(prev => !prev)
  }

  const handleToggleAudio = () => {
    setAudioEnabled(prev => !prev)
  }

  // Audio alert when distracted
  useAudioAlert(
    audioEnabled,
    !stats.isAttentive,
    stats.distractionDuration,
    5 // Alert after 5 seconds
  )

  return (
    <div className="app">
      <header className="header">
        <h1>Attention Monitor</h1>
      </header>

      <div className="main-container">
        <AttentionMonitor
          isPaused={isPaused}
          thresholds={thresholds}
          onStatsUpdate={setStats}
          stats={stats}
        />

        <div className="sidebar">
          <StatsOverlay stats={stats} />

          <ThresholdControls
            thresholds={thresholds}
            onThresholdsChange={setThresholds}
            onReset={handleReset}
            onTogglePause={handleTogglePause}
            isPaused={isPaused}
            audioEnabled={audioEnabled}
            onToggleAudio={handleToggleAudio}
          />

          <div className="debug-panel">
            <h3>Debug Values</h3>
            <div className="debug-row">
              <span>Face X:</span>
              <span>{stats.noseOffsetX.toFixed(2)} (thr: {thresholds.face.toFixed(2)})</span>
            </div>
            <div className="debug-row">
              <span>Face Y:</span>
              <span>{stats.noseOffsetY.toFixed(2)}</span>
            </div>
            <div className="debug-row">
              <span>Eye X:</span>
              <span>{stats.avgEyeGazeX.toFixed(2)} (thr: {thresholds.eye.toFixed(2)})</span>
            </div>
            <div className="debug-row">
              <span>Eye Y:</span>
              <span>{stats.avgEyeGazeY.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
