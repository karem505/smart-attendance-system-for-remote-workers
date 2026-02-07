import React from 'react'

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function StatsOverlay({ stats }) {
  const {
    isAttentive,
    faceDetected,
    faceLooking,
    eyesLooking,
    sessionTime,
    attentionTime,
    attentionPercentage
  } = stats

  const getPercentageClass = () => {
    if (attentionPercentage >= 70) return 'good'
    if (attentionPercentage >= 50) return 'warning'
    return 'bad'
  }

  const getFaceStatus = () => {
    if (!faceDetected) return { text: 'Not Found', className: 'none' }
    if (faceLooking) return { text: 'OK', className: 'ok' }
    return { text: 'Away', className: 'away' }
  }

  const getEyeStatus = () => {
    if (!faceDetected) return { text: '-', className: 'none' }
    if (eyesLooking) return { text: 'OK', className: 'ok' }
    return { text: 'Away', className: 'away' }
  }

  const faceStatus = getFaceStatus()
  const eyeStatus = getEyeStatus()

  return (
    <div className="stats-panel">
      <h2>Session Stats</h2>

      <div className={`status ${isAttentive ? 'attentive' : 'distracted'}`}>
        {isAttentive ? 'ATTENTIVE' : 'DISTRACTED'}
      </div>

      <div className="stat-row">
        <span className="stat-label">Session Time</span>
        <span className="stat-value">{formatTime(sessionTime)}</span>
      </div>

      <div className="stat-row">
        <span className="stat-label">Attention Time</span>
        <span className="stat-value">{formatTime(attentionTime)}</span>
      </div>

      <div className="stat-row">
        <span className="stat-label">Attention Rate</span>
        <span className={`stat-value ${getPercentageClass()}`}>
          {attentionPercentage.toFixed(1)}%
        </span>
      </div>

      <div className="detection-status">
        <div className={`detection-item ${faceStatus.className}`}>
          Face: {faceStatus.text}
        </div>
        <div className={`detection-item ${eyeStatus.className}`}>
          Eyes: {eyeStatus.text}
        </div>
      </div>
    </div>
  )
}

export default StatsOverlay
