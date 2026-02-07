import { useRef, useEffect, useState, useCallback } from 'react'

// MediaPipe CDN URLs
const FACE_MESH_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh'
const CAMERA_UTILS_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils'

// Error messages
const ERROR_MESSAGES = {
  HTTPS_REQUIRED: 'Camera requires HTTPS. Please access via https://',
  NOT_SUPPORTED: 'Camera not supported. Please use a modern browser.',
  PERMISSION_DENIED: 'Camera permission denied. Please allow camera access and refresh.',
  NOT_FOUND: 'No camera found. Please connect a camera.',
  IN_USE: 'Camera is in use by another application.',
  CDN_ERROR: 'Unable to load face detection models. Check your network.',
  UNKNOWN: 'Camera error. Please refresh and try again.'
}

// Landmark indices (same as Python version)
const LANDMARKS = {
  NOSE_TIP: 4,
  FOREHEAD: 10,
  CHIN: 152,
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
  LEFT_IRIS_CENTER: 468,
  RIGHT_IRIS_CENTER: 473,
  LEFT_EYE_LEFT: 33,
  LEFT_EYE_RIGHT: 133,
  LEFT_EYE_TOP: 159,
  LEFT_EYE_BOTTOM: 145,
  RIGHT_EYE_LEFT: 362,
  RIGHT_EYE_RIGHT: 263,
  RIGHT_EYE_TOP: 386,
  RIGHT_EYE_BOTTOM: 374
}

const HYSTERESIS_DELAY = 300 // ms

export function useAttentionDetector(videoRef, canvasRef, thresholds, isPaused) {
  const faceMeshRef = useRef(null)
  const cameraRef = useRef(null)
  const lastStateChangeRef = useRef(Date.now())
  const pendingStateRef = useRef(null)
  const isAttentiveRef = useRef(false)
  const thresholdsRef = useRef(thresholds)
  const canvasRefInternal = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const isInitializedRef = useRef(false)

  const [detectionState, setDetectionState] = useState({
    faceDetected: false,
    faceLooking: false,
    eyesLooking: false,
    isAttentive: false,
    noseOffsetX: 0,
    noseOffsetY: 0,
    leftEyeGazeX: 0,
    leftEyeGazeY: 0,
    rightEyeGazeX: 0,
    rightEyeGazeY: 0,
    avgEyeGazeX: 0,
    avgEyeGazeY: 0
  })

  // Keep thresholds ref updated
  useEffect(() => {
    thresholdsRef.current = thresholds
  }, [thresholds])

  // Keep canvas ref updated
  useEffect(() => {
    canvasRefInternal.current = canvasRef.current
  }, [canvasRef])

  // Initialize MediaPipe Face Mesh - only once
  useEffect(() => {
    if (!videoRef.current || isInitializedRef.current) return

    const calculateFaceDirection = (landmarks) => {
      const nose = landmarks[LANDMARKS.NOSE_TIP]
      const leftCheek = landmarks[LANDMARKS.LEFT_CHEEK]
      const rightCheek = landmarks[LANDMARKS.RIGHT_CHEEK]
      const forehead = landmarks[LANDMARKS.FOREHEAD]
      const chin = landmarks[LANDMARKS.CHIN]

      const faceCenterX = (leftCheek.x + rightCheek.x) / 2
      const faceCenterY = (forehead.y + chin.y) / 2
      const faceWidth = Math.abs(rightCheek.x - leftCheek.x)
      const faceHeight = Math.abs(chin.y - forehead.y)

      let noseOffsetX = 0
      let noseOffsetY = 0

      if (faceWidth > 0 && faceHeight > 0) {
        noseOffsetX = (nose.x - faceCenterX) / faceWidth
        noseOffsetY = (nose.y - faceCenterY) / faceHeight
      }

      const faceLooking =
        Math.abs(noseOffsetX) < thresholdsRef.current.face &&
        Math.abs(noseOffsetY) < thresholdsRef.current.face

      return { noseOffsetX, noseOffsetY, faceLooking }
    }

    const calculateEyeGaze = (landmarks) => {
      // Left eye
      const leftIris = landmarks[LANDMARKS.LEFT_IRIS_CENTER]
      const leftEyeLeft = landmarks[LANDMARKS.LEFT_EYE_LEFT]
      const leftEyeRight = landmarks[LANDMARKS.LEFT_EYE_RIGHT]
      const leftEyeTop = landmarks[LANDMARKS.LEFT_EYE_TOP]
      const leftEyeBottom = landmarks[LANDMARKS.LEFT_EYE_BOTTOM]

      const leftEyeCenterX = (leftEyeLeft.x + leftEyeRight.x) / 2
      const leftEyeCenterY = (leftEyeTop.y + leftEyeBottom.y) / 2
      const leftEyeWidth = Math.abs(leftEyeRight.x - leftEyeLeft.x)
      const leftEyeHeight = Math.abs(leftEyeBottom.y - leftEyeTop.y)

      let leftEyeGazeX = 0
      let leftEyeGazeY = 0

      if (leftEyeWidth > 0 && leftEyeHeight > 0) {
        leftEyeGazeX = (leftIris.x - leftEyeCenterX) / leftEyeWidth
        leftEyeGazeY = (leftIris.y - leftEyeCenterY) / leftEyeHeight
      }

      // Right eye
      const rightIris = landmarks[LANDMARKS.RIGHT_IRIS_CENTER]
      const rightEyeLeft = landmarks[LANDMARKS.RIGHT_EYE_LEFT]
      const rightEyeRight = landmarks[LANDMARKS.RIGHT_EYE_RIGHT]
      const rightEyeTop = landmarks[LANDMARKS.RIGHT_EYE_TOP]
      const rightEyeBottom = landmarks[LANDMARKS.RIGHT_EYE_BOTTOM]

      const rightEyeCenterX = (rightEyeLeft.x + rightEyeRight.x) / 2
      const rightEyeCenterY = (rightEyeTop.y + rightEyeBottom.y) / 2
      const rightEyeWidth = Math.abs(rightEyeRight.x - rightEyeLeft.x)
      const rightEyeHeight = Math.abs(rightEyeBottom.y - rightEyeTop.y)

      let rightEyeGazeX = 0
      let rightEyeGazeY = 0

      if (rightEyeWidth > 0 && rightEyeHeight > 0) {
        rightEyeGazeX = (rightIris.x - rightEyeCenterX) / rightEyeWidth
        rightEyeGazeY = (rightIris.y - rightEyeCenterY) / rightEyeHeight
      }

      const avgGazeX = (Math.abs(leftEyeGazeX) + Math.abs(rightEyeGazeX)) / 2
      const avgGazeY = (Math.abs(leftEyeGazeY) + Math.abs(rightEyeGazeY)) / 2

      const eyesLooking = avgGazeX < thresholdsRef.current.eye && avgGazeY < thresholdsRef.current.eye

      return {
        leftEyeGazeX,
        leftEyeGazeY,
        rightEyeGazeX,
        rightEyeGazeY,
        avgEyeGazeX: avgGazeX,
        avgEyeGazeY: avgGazeY,
        eyesLooking
      }
    }

    const updateAttentionState = (newState) => {
      const currentTime = Date.now()

      if (newState !== isAttentiveRef.current) {
        if (pendingStateRef.current !== newState) {
          pendingStateRef.current = newState
          lastStateChangeRef.current = currentTime
        } else if (currentTime - lastStateChangeRef.current >= HYSTERESIS_DELAY) {
          isAttentiveRef.current = newState
          pendingStateRef.current = null
          return newState
        }
      } else {
        pendingStateRef.current = null
      }

      return isAttentiveRef.current
    }

    const drawLandmarks = (ctx, landmarks, width, height, faceLooking, eyesLooking) => {
      const nose = landmarks[LANDMARKS.NOSE_TIP]
      const leftCheek = landmarks[LANDMARKS.LEFT_CHEEK]
      const rightCheek = landmarks[LANDMARKS.RIGHT_CHEEK]
      const forehead = landmarks[LANDMARKS.FOREHEAD]
      const chin = landmarks[LANDMARKS.CHIN]

      // Face center
      const centerX = ((leftCheek.x + rightCheek.x) / 2) * width
      const centerY = ((forehead.y + chin.y) / 2) * height

      // Nose position
      const noseX = nose.x * width
      const noseY = nose.y * height

      // Draw face center (green dot)
      ctx.beginPath()
      ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI)
      ctx.fillStyle = '#00ff00'
      ctx.fill()

      // Draw nose (blue dot)
      ctx.beginPath()
      ctx.arc(noseX, noseY, 5, 0, 2 * Math.PI)
      ctx.fillStyle = '#0000ff'
      ctx.fill()

      // Draw line from center to nose
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(noseX, noseY)
      ctx.strokeStyle = faceLooking ? '#00ff00' : '#ff0000'
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw iris positions
      const eyeColor = eyesLooking ? '#00ff00' : '#ffa500'

      // Left iris
      const leftIris = landmarks[LANDMARKS.LEFT_IRIS_CENTER]
      ctx.beginPath()
      ctx.arc(leftIris.x * width, leftIris.y * height, 4, 0, 2 * Math.PI)
      ctx.fillStyle = eyeColor
      ctx.fill()

      // Right iris
      const rightIris = landmarks[LANDMARKS.RIGHT_IRIS_CENTER]
      ctx.beginPath()
      ctx.arc(rightIris.x * width, rightIris.y * height, 4, 0, 2 * Math.PI)
      ctx.fillStyle = eyeColor
      ctx.fill()

      // Eye centers (white dots)
      const leftEyeLeft = landmarks[LANDMARKS.LEFT_EYE_LEFT]
      const leftEyeRight = landmarks[LANDMARKS.LEFT_EYE_RIGHT]
      const leftEyeTop = landmarks[LANDMARKS.LEFT_EYE_TOP]
      const leftEyeBottom = landmarks[LANDMARKS.LEFT_EYE_BOTTOM]
      const leftEyeCenterX = ((leftEyeLeft.x + leftEyeRight.x) / 2) * width
      const leftEyeCenterY = ((leftEyeTop.y + leftEyeBottom.y) / 2) * height

      ctx.beginPath()
      ctx.arc(leftEyeCenterX, leftEyeCenterY, 2, 0, 2 * Math.PI)
      ctx.fillStyle = '#ffffff'
      ctx.fill()

      const rightEyeLeft = landmarks[LANDMARKS.RIGHT_EYE_LEFT]
      const rightEyeRight = landmarks[LANDMARKS.RIGHT_EYE_RIGHT]
      const rightEyeTop = landmarks[LANDMARKS.RIGHT_EYE_TOP]
      const rightEyeBottom = landmarks[LANDMARKS.RIGHT_EYE_BOTTOM]
      const rightEyeCenterX = ((rightEyeLeft.x + rightEyeRight.x) / 2) * width
      const rightEyeCenterY = ((rightEyeTop.y + rightEyeBottom.y) / 2) * height

      ctx.beginPath()
      ctx.arc(rightEyeCenterX, rightEyeCenterY, 2, 0, 2 * Math.PI)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }

    const onResults = (results) => {
      const canvas = canvasRefInternal.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      const width = canvas.width
      const height = canvas.height

      ctx.clearRect(0, 0, width, height)

      // Draw video frame
      ctx.drawImage(results.image, 0, 0, width, height)

      let faceDetected = false
      let faceLooking = false
      let eyesLooking = false
      let noseOffsetX = 0
      let noseOffsetY = 0
      let eyeData = {
        leftEyeGazeX: 0,
        leftEyeGazeY: 0,
        rightEyeGazeX: 0,
        rightEyeGazeY: 0,
        avgEyeGazeX: 0,
        avgEyeGazeY: 0
      }

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        faceDetected = true
        const landmarks = results.multiFaceLandmarks[0]

        // Calculate face direction
        const faceResult = calculateFaceDirection(landmarks)
        noseOffsetX = faceResult.noseOffsetX
        noseOffsetY = faceResult.noseOffsetY
        faceLooking = faceResult.faceLooking

        // Calculate eye gaze
        eyeData = calculateEyeGaze(landmarks)
        eyesLooking = eyeData.eyesLooking

        // Draw landmarks
        drawLandmarks(ctx, landmarks, width, height, faceLooking, eyesLooking)
      }

      // Determine attention state with hysteresis
      const rawAttentive = faceDetected && faceLooking && eyesLooking
      const isAttentive = updateAttentionState(rawAttentive)

      setDetectionState({
        faceDetected,
        faceLooking,
        eyesLooking,
        isAttentive,
        noseOffsetX,
        noseOffsetY,
        ...eyeData
      })
    }

    // Helper function to load script from CDN
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve()
          return
        }
        const script = document.createElement('script')
        script.src = src
        script.crossOrigin = 'anonymous'
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })
    }

    const initFaceMesh = async () => {
      setIsLoading(true)
      setError(null)
      isInitializedRef.current = true

      try {
        // Step 1: Check HTTPS requirement
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
          setError(ERROR_MESSAGES.HTTPS_REQUIRED)
          setIsLoading(false)
          return
        }

        // Step 2: Check browser support for getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError(ERROR_MESSAGES.NOT_SUPPORTED)
          setIsLoading(false)
          return
        }

        // Step 3: Request camera permission explicitly
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          // Release the stream immediately - MediaPipe Camera will request its own
          stream.getTracks().forEach(track => track.stop())
        } catch (permissionError) {
          console.error('Camera permission error:', permissionError)
          if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
            setError(ERROR_MESSAGES.PERMISSION_DENIED)
          } else if (permissionError.name === 'NotFoundError' || permissionError.name === 'DevicesNotFoundError') {
            setError(ERROR_MESSAGES.NOT_FOUND)
          } else if (permissionError.name === 'NotReadableError' || permissionError.name === 'TrackStartError') {
            setError(ERROR_MESSAGES.IN_USE)
          } else {
            setError(`${ERROR_MESSAGES.UNKNOWN} (${permissionError.message})`)
          }
          setIsLoading(false)
          return
        }

        // Step 4: Load MediaPipe scripts from CDN
        try {
          await loadScript(`${CAMERA_UTILS_CDN}/camera_utils.js`)
          await loadScript(`${FACE_MESH_CDN}/face_mesh.js`)
        } catch (loadError) {
          console.error('Failed to load MediaPipe scripts:', loadError)
          setError(ERROR_MESSAGES.CDN_ERROR)
          setIsLoading(false)
          return
        }

        // Step 5: Initialize MediaPipe FaceMesh from global
        const FaceMesh = window.FaceMesh
        const Camera = window.Camera

        if (!FaceMesh || !Camera) {
          setError(ERROR_MESSAGES.CDN_ERROR)
          setIsLoading(false)
          return
        }

        const faceMesh = new FaceMesh({
          locateFile: (file) => {
            return `${FACE_MESH_CDN}/${file}`
          }
        })

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true, // Required for iris tracking
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        })

        faceMesh.onResults(onResults)
        faceMeshRef.current = faceMesh

        // Step 6: Initialize camera with MediaPipe
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (faceMeshRef.current && videoRef.current) {
              await faceMeshRef.current.send({ image: videoRef.current })
            }
          },
          width: 640,
          height: 480
        })

        cameraRef.current = camera
        await camera.start()
        setIsLoading(false)
      } catch (error) {
        console.error('Error initializing face mesh:', error)
        // Check if it's a CDN/network error
        if (error.message && (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('load'))) {
          setError(ERROR_MESSAGES.CDN_ERROR)
        } else {
          setError(`${ERROR_MESSAGES.UNKNOWN} (${error.message || 'Unknown error'})`)
        }
        setIsLoading(false)
      }
    }

    initFaceMesh()

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop()
      }
      isInitializedRef.current = false
    }
  }, [videoRef]) // Only depend on videoRef

  // Handle pause/resume
  useEffect(() => {
    if (!cameraRef.current) return

    if (isPaused) {
      cameraRef.current.stop()
    } else {
      cameraRef.current.start()
    }
  }, [isPaused])

  // Retry function to reinitialize camera
  const retry = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop()
    }
    isInitializedRef.current = false
    setError(null)
    setIsLoading(true)
    // Trigger re-initialization by updating a dependency
    // The useEffect will run again when isInitializedRef is false
    setTimeout(() => {
      if (videoRef.current) {
        // Force re-run of initialization
        isInitializedRef.current = false
        // We need to trigger the useEffect again
        window.location.reload()
      }
    }, 100)
  }, [videoRef])

  return { detectionState, isLoading, error, retry }
}

export default useAttentionDetector
