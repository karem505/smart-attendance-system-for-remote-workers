import React from 'react'

function ThresholdControls({
  thresholds,
  onThresholdsChange,
  onReset,
  onTogglePause,
  isPaused,
  audioEnabled,
  onToggleAudio
}) {
  const handleFaceThresholdChange = (e) => {
    onThresholdsChange({
      ...thresholds,
      face: parseFloat(e.target.value)
    })
  }

  const handleEyeThresholdChange = (e) => {
    onThresholdsChange({
      ...thresholds,
      eye: parseFloat(e.target.value)
    })
  }

  return (
    <div className="controls-panel">
      <h2>Controls</h2>

      <div className="threshold-control">
        <label>
          <span>Face Threshold</span>
          <span>{thresholds.face.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0.1"
          max="0.5"
          step="0.01"
          value={thresholds.face}
          onChange={handleFaceThresholdChange}
        />
      </div>

      <div className="threshold-control">
        <label>
          <span>Eye Threshold</span>
          <span>{thresholds.eye.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0.1"
          max="0.5"
          step="0.01"
          value={thresholds.eye}
          onChange={handleEyeThresholdChange}
        />
      </div>

      <div className="toggle-control">
        <label className="toggle-label">
          <span>Sound Alert</span>
          <button
            className={`toggle-btn ${audioEnabled ? 'active' : ''}`}
            onClick={onToggleAudio}
          >
            {audioEnabled ? 'ON' : 'OFF'}
          </button>
        </label>
      </div>

      <div className="button-row">
        <button className="btn btn-reset" onClick={onReset}>
          Reset
        </button>
        <button
          className={`btn ${isPaused ? 'btn-resume' : 'btn-pause'}`}
          onClick={onTogglePause}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </div>
  )
}

export default ThresholdControls
