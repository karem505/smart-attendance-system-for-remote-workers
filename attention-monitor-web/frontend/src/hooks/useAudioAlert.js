import { useRef, useEffect, useCallback } from 'react'

export function useAudioAlert(enabled, isDistracted, distractionDuration, alertDelay = 5) {
  const audioContextRef = useRef(null)
  const lastBeepRef = useRef(0)
  const beepIntervalMs = 1000 // Beep every 1 second when distracted

  const playBeep = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }

    const ctx = audioContextRef.current
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.value = 800 // Hz
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.3)
  }, [])

  useEffect(() => {
    if (!enabled || !isDistracted || distractionDuration < alertDelay) {
      return
    }

    const now = Date.now()
    if (now - lastBeepRef.current >= beepIntervalMs) {
      playBeep()
      lastBeepRef.current = now
    }
  }, [enabled, isDistracted, distractionDuration, alertDelay, playBeep])

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])
}

export default useAudioAlert
