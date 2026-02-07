"""
Attention Detection Program
Uses webcam to monitor user attention through face detection and head pose.
Tracks attention time and provides visual alerts when distracted.
"""

import cv2
import mediapipe as mp
import numpy as np
import csv
import time
from datetime import datetime
from pathlib import Path


# Configuration thresholds
class Config:
    # Face detection: nose position relative to face center
    NOSE_OFFSET_THRESHOLD = 0.31     # How far nose can be off-center (0-1 scale)

    # Eye/Gaze detection: iris position within eye
    EYE_GAZE_THRESHOLD = 0.22        # How far iris can be from eye center (0-0.5 scale)

    DISTRACTION_ALERT_DELAY = 5.0    # seconds before showing alert
    HYSTERESIS_DELAY = 0.3           # seconds to prevent state flickering
    LOG_INTERVAL = 1.0               # seconds between CSV log entries
    DEBUG_MODE = True                # Show debug values on screen


class AttentionTimer:
    """Tracks attention and session timing statistics."""

    def __init__(self):
        self.session_start = time.time()
        self.total_attention_time = 0.0
        self.last_update_time = time.time()
        self.is_currently_attentive = False
        self.attention_start_time = None
        self.distraction_start_time = None
        self.current_distraction_duration = 0.0

    def update(self, is_attentive: bool):
        """Update timers based on current attention state."""
        current_time = time.time()
        elapsed = current_time - self.last_update_time

        if is_attentive:
            self.total_attention_time += elapsed
            self.current_distraction_duration = 0.0
            if not self.is_currently_attentive:
                self.attention_start_time = current_time
                self.distraction_start_time = None
        else:
            if self.distraction_start_time is None:
                self.distraction_start_time = current_time
            self.current_distraction_duration = current_time - self.distraction_start_time

        self.is_currently_attentive = is_attentive
        self.last_update_time = current_time

    def get_session_time(self) -> float:
        return time.time() - self.session_start

    def get_attention_percentage(self) -> float:
        session_time = self.get_session_time()
        if session_time == 0:
            return 100.0
        return (self.total_attention_time / session_time) * 100

    def format_time(self, seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"

    def reset(self):
        self.__init__()


class AttentionDetector:
    """Attention detection using face mesh landmarks and iris tracking."""

    # Key landmark indices
    NOSE_TIP = 4           # Nose tip
    FOREHEAD = 10          # Top of face
    CHIN = 152             # Bottom of face
    LEFT_CHEEK = 234       # Left side of face
    RIGHT_CHEEK = 454      # Right side of face

    # Iris landmarks (with refine_landmarks=True)
    LEFT_IRIS_CENTER = 468
    RIGHT_IRIS_CENTER = 473

    # Eye corner landmarks for gaze calculation
    LEFT_EYE_LEFT = 33     # Left eye, left corner
    LEFT_EYE_RIGHT = 133   # Left eye, right corner
    LEFT_EYE_TOP = 159     # Left eye, top
    LEFT_EYE_BOTTOM = 145  # Left eye, bottom

    RIGHT_EYE_LEFT = 362   # Right eye, left corner
    RIGHT_EYE_RIGHT = 263  # Right eye, right corner
    RIGHT_EYE_TOP = 386    # Right eye, top
    RIGHT_EYE_BOTTOM = 374 # Right eye, bottom

    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.mp_drawing = mp.solutions.drawing_utils
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

        # State
        self.face_detected = False
        self.is_attentive = False
        self.last_state_change = time.time()
        self.pending_state = None

        # Face tracking
        self.nose_offset_x = 0.0
        self.nose_offset_y = 0.0
        self.face_width = 0.0
        self.face_looking_at_screen = False

        # Eye tracking
        self.left_eye_gaze_x = 0.0
        self.left_eye_gaze_y = 0.0
        self.right_eye_gaze_x = 0.0
        self.right_eye_gaze_y = 0.0
        self.eyes_looking_at_screen = False

    def process_frame(self, frame):
        """Process frame and determine attention state."""
        img_h, img_w = frame.shape[:2]

        # Convert to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)

        self.face_detected = False
        self.face_looking_at_screen = False
        self.eyes_looking_at_screen = False

        if results.multi_face_landmarks:
            self.face_detected = True
            landmarks = results.multi_face_landmarks[0].landmark

            # === FACE TRACKING ===
            nose = landmarks[self.NOSE_TIP]
            left_cheek = landmarks[self.LEFT_CHEEK]
            right_cheek = landmarks[self.RIGHT_CHEEK]
            forehead = landmarks[self.FOREHEAD]
            chin = landmarks[self.CHIN]

            face_center_x = (left_cheek.x + right_cheek.x) / 2
            face_center_y = (forehead.y + chin.y) / 2

            self.face_width = abs(right_cheek.x - left_cheek.x)
            face_height = abs(chin.y - forehead.y)

            if self.face_width > 0 and face_height > 0:
                self.nose_offset_x = (nose.x - face_center_x) / self.face_width
                self.nose_offset_y = (nose.y - face_center_y) / face_height
            else:
                self.nose_offset_x = 0
                self.nose_offset_y = 0

            self.face_looking_at_screen = (
                abs(self.nose_offset_x) < Config.NOSE_OFFSET_THRESHOLD and
                abs(self.nose_offset_y) < Config.NOSE_OFFSET_THRESHOLD
            )

            # === EYE/IRIS TRACKING ===
            self._calculate_eye_gaze(landmarks)

            # Draw landmarks for visualization
            self._draw_landmarks(frame, landmarks, img_w, img_h)

        # Attention = face looking at screen AND eyes looking at screen
        new_attentive = self.face_detected and self.face_looking_at_screen and self.eyes_looking_at_screen
        self._update_attention_state(new_attentive)

        return frame

    def _calculate_eye_gaze(self, landmarks):
        """Calculate eye gaze direction from iris position within eye bounds."""
        # Left eye
        left_iris = landmarks[self.LEFT_IRIS_CENTER]
        left_eye_left = landmarks[self.LEFT_EYE_LEFT]
        left_eye_right = landmarks[self.LEFT_EYE_RIGHT]
        left_eye_top = landmarks[self.LEFT_EYE_TOP]
        left_eye_bottom = landmarks[self.LEFT_EYE_BOTTOM]

        # Calculate left eye center
        left_eye_center_x = (left_eye_left.x + left_eye_right.x) / 2
        left_eye_center_y = (left_eye_top.y + left_eye_bottom.y) / 2
        left_eye_width = abs(left_eye_right.x - left_eye_left.x)
        left_eye_height = abs(left_eye_bottom.y - left_eye_top.y)

        # Iris offset from eye center (normalized)
        if left_eye_width > 0 and left_eye_height > 0:
            self.left_eye_gaze_x = (left_iris.x - left_eye_center_x) / left_eye_width
            self.left_eye_gaze_y = (left_iris.y - left_eye_center_y) / left_eye_height
        else:
            self.left_eye_gaze_x = 0
            self.left_eye_gaze_y = 0

        # Right eye
        right_iris = landmarks[self.RIGHT_IRIS_CENTER]
        right_eye_left = landmarks[self.RIGHT_EYE_LEFT]
        right_eye_right = landmarks[self.RIGHT_EYE_RIGHT]
        right_eye_top = landmarks[self.RIGHT_EYE_TOP]
        right_eye_bottom = landmarks[self.RIGHT_EYE_BOTTOM]

        # Calculate right eye center
        right_eye_center_x = (right_eye_left.x + right_eye_right.x) / 2
        right_eye_center_y = (right_eye_top.y + right_eye_bottom.y) / 2
        right_eye_width = abs(right_eye_right.x - right_eye_left.x)
        right_eye_height = abs(right_eye_bottom.y - right_eye_top.y)

        # Iris offset from eye center (normalized)
        if right_eye_width > 0 and right_eye_height > 0:
            self.right_eye_gaze_x = (right_iris.x - right_eye_center_x) / right_eye_width
            self.right_eye_gaze_y = (right_iris.y - right_eye_center_y) / right_eye_height
        else:
            self.right_eye_gaze_x = 0
            self.right_eye_gaze_y = 0

        # Average gaze from both eyes
        avg_gaze_x = (abs(self.left_eye_gaze_x) + abs(self.right_eye_gaze_x)) / 2
        avg_gaze_y = (abs(self.left_eye_gaze_y) + abs(self.right_eye_gaze_y)) / 2

        # Eyes looking at screen if iris is near center of eye
        self.eyes_looking_at_screen = (
            avg_gaze_x < Config.EYE_GAZE_THRESHOLD and
            avg_gaze_y < Config.EYE_GAZE_THRESHOLD
        )

    def _update_attention_state(self, new_state: bool):
        """Update attention state with hysteresis."""
        current_time = time.time()

        if new_state != self.is_attentive:
            if self.pending_state != new_state:
                self.pending_state = new_state
                self.last_state_change = current_time
            elif current_time - self.last_state_change >= Config.HYSTERESIS_DELAY:
                self.is_attentive = new_state
                self.pending_state = None
        else:
            self.pending_state = None

    def _draw_landmarks(self, frame, landmarks, img_w, img_h):
        """Draw key points on the frame."""
        # Draw nose tip (blue)
        nose = landmarks[self.NOSE_TIP]
        nose_pt = (int(nose.x * img_w), int(nose.y * img_h))
        cv2.circle(frame, nose_pt, 5, (255, 0, 0), -1)

        # Draw face center reference (green)
        left_cheek = landmarks[self.LEFT_CHEEK]
        right_cheek = landmarks[self.RIGHT_CHEEK]
        forehead = landmarks[self.FOREHEAD]
        chin = landmarks[self.CHIN]

        center_x = int((left_cheek.x + right_cheek.x) / 2 * img_w)
        center_y = int((forehead.y + chin.y) / 2 * img_h)
        cv2.circle(frame, (center_x, center_y), 5, (0, 255, 0), -1)

        # Draw line from center to nose (shows face direction)
        face_color = (0, 255, 0) if self.face_looking_at_screen else (0, 0, 255)
        cv2.line(frame, (center_x, center_y), nose_pt, face_color, 2)

        # Draw eye tracking visualization
        eye_color = (0, 255, 0) if self.eyes_looking_at_screen else (0, 165, 255)  # Green or orange

        # Left eye - draw iris and eye center
        left_iris = landmarks[self.LEFT_IRIS_CENTER]
        left_iris_pt = (int(left_iris.x * img_w), int(left_iris.y * img_h))

        left_eye_left = landmarks[self.LEFT_EYE_LEFT]
        left_eye_right = landmarks[self.LEFT_EYE_RIGHT]
        left_eye_center_x = int((left_eye_left.x + left_eye_right.x) / 2 * img_w)
        left_eye_top = landmarks[self.LEFT_EYE_TOP]
        left_eye_bottom = landmarks[self.LEFT_EYE_BOTTOM]
        left_eye_center_y = int((left_eye_top.y + left_eye_bottom.y) / 2 * img_h)

        cv2.circle(frame, (left_eye_center_x, left_eye_center_y), 2, (255, 255, 255), -1)  # Eye center (white)
        cv2.circle(frame, left_iris_pt, 4, eye_color, -1)  # Iris (green/orange)

        # Right eye - draw iris and eye center
        right_iris = landmarks[self.RIGHT_IRIS_CENTER]
        right_iris_pt = (int(right_iris.x * img_w), int(right_iris.y * img_h))

        right_eye_left = landmarks[self.RIGHT_EYE_LEFT]
        right_eye_right = landmarks[self.RIGHT_EYE_RIGHT]
        right_eye_center_x = int((right_eye_left.x + right_eye_right.x) / 2 * img_w)
        right_eye_top = landmarks[self.RIGHT_EYE_TOP]
        right_eye_bottom = landmarks[self.RIGHT_EYE_BOTTOM]
        right_eye_center_y = int((right_eye_top.y + right_eye_bottom.y) / 2 * img_h)

        cv2.circle(frame, (right_eye_center_x, right_eye_center_y), 2, (255, 255, 255), -1)  # Eye center (white)
        cv2.circle(frame, right_iris_pt, 4, eye_color, -1)  # Iris (green/orange)


class DataLogger:
    """Logs attention data to CSV file."""

    def __init__(self, log_dir: str = "."):
        self.log_dir = Path(log_dir)
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file = self.log_dir / f"attention_log_{self.session_id}.csv"
        self.summary_file = self.log_dir / "attention_summary.csv"
        self.last_log_time = 0.0

        with open(self.log_file, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'timestamp', 'is_attentive', 'face_detected',
                'face_looking', 'eyes_looking',
                'nose_offset_x', 'nose_offset_y',
                'eye_gaze_x', 'eye_gaze_y',
                'session_time', 'attention_time', 'attention_pct'
            ])

    def log(self, detector: AttentionDetector, timer: AttentionTimer):
        current_time = time.time()
        if current_time - self.last_log_time < Config.LOG_INTERVAL:
            return

        self.last_log_time = current_time

        avg_eye_x = (abs(detector.left_eye_gaze_x) + abs(detector.right_eye_gaze_x)) / 2
        avg_eye_y = (abs(detector.left_eye_gaze_y) + abs(detector.right_eye_gaze_y)) / 2

        with open(self.log_file, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.now().isoformat(),
                int(detector.is_attentive),
                int(detector.face_detected),
                int(detector.face_looking_at_screen),
                int(detector.eyes_looking_at_screen),
                f"{detector.nose_offset_x:.3f}",
                f"{detector.nose_offset_y:.3f}",
                f"{avg_eye_x:.3f}",
                f"{avg_eye_y:.3f}",
                f"{timer.get_session_time():.1f}",
                f"{timer.total_attention_time:.1f}",
                f"{timer.get_attention_percentage():.1f}"
            ])

    def save_summary(self, timer: AttentionTimer):
        write_header = not self.summary_file.exists()

        with open(self.summary_file, 'a', newline='') as f:
            writer = csv.writer(f)
            if write_header:
                writer.writerow([
                    'session_id', 'start_time', 'end_time',
                    'total_time_sec', 'attention_time_sec', 'attention_pct'
                ])
            writer.writerow([
                self.session_id,
                datetime.fromtimestamp(timer.session_start).isoformat(),
                datetime.now().isoformat(),
                f"{timer.get_session_time():.1f}",
                f"{timer.total_attention_time:.1f}",
                f"{timer.get_attention_percentage():.1f}"
            ])


class AttentionMonitorUI:
    """Handles the visual display."""

    def __init__(self):
        self.window_name = "Attention Monitor"
        self.alert_flash_state = False
        self.last_flash_time = 0.0

    def draw_ui(self, frame, detector: AttentionDetector, timer: AttentionTimer):
        img_h, img_w = frame.shape[:2]

        # Border color based on attention
        border_color = (0, 200, 0) if detector.is_attentive else (0, 0, 200)
        cv2.rectangle(frame, (0, 0), (img_w-1, img_h-1), border_color, 4)

        # Stats overlay
        overlay = frame.copy()
        overlay_height = 280 if Config.DEBUG_MODE else 200
        cv2.rectangle(overlay, (10, 10), (320, overlay_height), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

        y_pos = 35
        line_height = 22

        # Status
        status_text = "ATTENTIVE" if detector.is_attentive else "DISTRACTED"
        status_color = (0, 255, 0) if detector.is_attentive else (0, 0, 255)
        cv2.putText(frame, f"Status: {status_text}", (20, y_pos),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
        y_pos += line_height

        # Times
        cv2.putText(frame, f"Session: {timer.format_time(timer.get_session_time())}",
                    (20, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        y_pos += line_height

        cv2.putText(frame, f"Attention: {timer.format_time(timer.total_attention_time)}",
                    (20, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        y_pos += line_height

        # Percentage
        pct = timer.get_attention_percentage()
        pct_color = (0, 255, 0) if pct >= 70 else (0, 255, 255) if pct >= 50 else (0, 0, 255)
        cv2.putText(frame, f"Rate: {pct:.1f}%",
                    (20, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.5, pct_color, 1)
        y_pos += line_height

        # Face status
        face_status = "OK" if detector.face_looking_at_screen else ("Away" if detector.face_detected else "Not Found")
        face_color = (0, 255, 0) if detector.face_looking_at_screen else (0, 100, 255)
        cv2.putText(frame, f"Face: {face_status}",
                    (20, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.5, face_color, 1)
        y_pos += line_height

        # Eye status
        eye_status = "OK" if detector.eyes_looking_at_screen else "Away"
        eye_color = (0, 255, 0) if detector.eyes_looking_at_screen else (0, 165, 255)
        cv2.putText(frame, f"Eyes: {eye_status}",
                    (20, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.5, eye_color, 1)
        y_pos += line_height

        # Debug info
        if Config.DEBUG_MODE:
            y_pos += 5
            cv2.putText(frame, f"Face: X={detector.nose_offset_x:.2f} Y={detector.nose_offset_y:.2f} (thr:{Config.NOSE_OFFSET_THRESHOLD:.2f})",
                        (20, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 0), 1)
            y_pos += 16
            avg_eye_x = (abs(detector.left_eye_gaze_x) + abs(detector.right_eye_gaze_x)) / 2
            avg_eye_y = (abs(detector.left_eye_gaze_y) + abs(detector.right_eye_gaze_y)) / 2
            cv2.putText(frame, f"Eyes: X={avg_eye_x:.2f} Y={avg_eye_y:.2f} (thr:{Config.EYE_GAZE_THRESHOLD:.2f})",
                        (20, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 0), 1)

        # Alert if distracted too long
        if timer.current_distraction_duration >= Config.DISTRACTION_ALERT_DELAY:
            self._draw_alert(frame, img_w, img_h)

        # Controls
        cv2.putText(frame, "Q:Quit R:Reset P:Pause F/E:Select +/-:Adjust",
                    (10, img_h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 200), 1)

        return frame

    def _draw_alert(self, frame, img_w, img_h):
        current_time = time.time()
        if current_time - self.last_flash_time >= 0.5:
            self.alert_flash_state = not self.alert_flash_state
            self.last_flash_time = current_time

        if self.alert_flash_state:
            banner_height = 60
            overlay = frame.copy()
            cv2.rectangle(overlay, (0, img_h // 2 - banner_height // 2),
                         (img_w, img_h // 2 + banner_height // 2), (0, 0, 200), -1)
            cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

            text = "ATTENTION NEEDED!"
            text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1.2, 3)[0]
            text_x = (img_w - text_size[0]) // 2
            text_y = img_h // 2 + text_size[1] // 2
            cv2.putText(frame, text, (text_x, text_y),
                       cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 3)


def main():
    print("Attention Detection Monitor")
    print("=" * 40)
    print("Controls:")
    print("  Q/ESC  - Quit and save")
    print("  R      - Reset counters")
    print("  P      - Pause/Resume")
    print("  F      - Select FACE threshold to adjust")
    print("  E      - Select EYE threshold to adjust")
    print("  +/=    - Increase threshold (more lenient)")
    print("  -      - Decrease threshold (stricter)")
    print("=" * 40)

    detector = AttentionDetector()
    timer = AttentionTimer()
    logger = DataLogger()
    ui = AttentionMonitorUI()

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open camera!")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    paused = False
    adjust_mode = "face"  # "face" or "eye"

    print("\nStarting attention monitoring...")
    print(f"Face threshold: {Config.NOSE_OFFSET_THRESHOLD}")
    print(f"Eye threshold: {Config.EYE_GAZE_THRESHOLD}")
    print("Press F to adjust face, E to adjust eyes, then +/- to change\n")

    try:
        while True:
            key = cv2.waitKey(1) & 0xFF

            if key == ord('q') or key == 27:
                break
            elif key == ord('r'):
                timer.reset()
                print("Counters reset!")
            elif key == ord('p'):
                paused = not paused
                print("Paused" if paused else "Resumed")
            elif key == ord('f'):
                adjust_mode = "face"
                print(f"Now adjusting: FACE threshold ({Config.NOSE_OFFSET_THRESHOLD:.2f})")
            elif key == ord('e'):
                adjust_mode = "eye"
                print(f"Now adjusting: EYE threshold ({Config.EYE_GAZE_THRESHOLD:.2f})")
            elif key == ord('+') or key == ord('='):
                if adjust_mode == "face":
                    Config.NOSE_OFFSET_THRESHOLD = min(0.5, Config.NOSE_OFFSET_THRESHOLD + 0.02)
                    print(f"Face threshold: {Config.NOSE_OFFSET_THRESHOLD:.2f} (more lenient)")
                else:
                    Config.EYE_GAZE_THRESHOLD = min(0.5, Config.EYE_GAZE_THRESHOLD + 0.02)
                    print(f"Eye threshold: {Config.EYE_GAZE_THRESHOLD:.2f} (more lenient)")
            elif key == ord('-'):
                if adjust_mode == "face":
                    Config.NOSE_OFFSET_THRESHOLD = max(0.05, Config.NOSE_OFFSET_THRESHOLD - 0.02)
                    print(f"Face threshold: {Config.NOSE_OFFSET_THRESHOLD:.2f} (stricter)")
                else:
                    Config.EYE_GAZE_THRESHOLD = max(0.1, Config.EYE_GAZE_THRESHOLD - 0.02)
                    print(f"Eye threshold: {Config.EYE_GAZE_THRESHOLD:.2f} (stricter)")

            if paused:
                continue

            ret, frame = cap.read()
            if not ret:
                print("Error: Could not read frame!")
                break

            frame = cv2.flip(frame, 1)
            frame = detector.process_frame(frame)
            timer.update(detector.is_attentive)
            logger.log(detector, timer)
            frame = ui.draw_ui(frame, detector, timer)
            cv2.imshow(ui.window_name, frame)

    except KeyboardInterrupt:
        print("\nInterrupted by user")

    finally:
        cap.release()
        cv2.destroyAllWindows()
        logger.save_summary(timer)

        print("\n" + "=" * 40)
        print("Session Summary")
        print("=" * 40)
        print(f"Total Session Time: {timer.format_time(timer.get_session_time())}")
        print(f"Total Attention Time: {timer.format_time(timer.total_attention_time)}")
        print(f"Attention Rate: {timer.get_attention_percentage():.1f}%")
        print(f"\nData saved to: {logger.log_file}")


if __name__ == "__main__":
    main()
