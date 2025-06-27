#!/usr/bin/env python3

import cv2
import mediapipe as mp
import numpy as np
import json
import base64
import sys
import argparse
import time

# Initialize MediaPipe Face Mesh and drawing utils
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils

# Eye landmark indices for left and right eyes (from MediaPipe Face Mesh)
LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]

def euclidean_dist(pt1, pt2):
    return np.linalg.norm(np.array(pt1) - np.array(pt2))

def eye_aspect_ratio(eye_landmarks):
    # Compute the eye aspect ratio (EAR)
    A = euclidean_dist(eye_landmarks[1], eye_landmarks[5])
    B = euclidean_dist(eye_landmarks[2], eye_landmarks[4])
    C = euclidean_dist(eye_landmarks[0], eye_landmarks[3])
    ear = (A + B) / (2.0 * C)
    return ear

def initialize_camera_safely():
    """Initialize camera with improved error handling"""
    cap = None
    camera_found = False
    
    # Try different camera indices and backends
    camera_options = [
        (0, cv2.CAP_AVFOUNDATION),  # macOS default
        (0, cv2.CAP_ANY),           # Any backend
        (1, cv2.CAP_AVFOUNDATION),  # External camera on macOS
        (1, cv2.CAP_ANY),
    ]
    
    for camera_id, backend in camera_options:
        try:
            print(json.dumps({"status": f"trying_camera_{camera_id}"}), flush=True)
            
            cap = cv2.VideoCapture(camera_id, backend)
            
            if cap.isOpened():
                # Give camera time to initialize
                time.sleep(0.5)
                
                # Test if we can actually read from the camera
                ret, test_frame = cap.read()
                if ret and test_frame is not None and test_frame.size > 0:
                    camera_found = True
                    print(json.dumps({"status": f"camera_{camera_id}_success"}), flush=True)
                    break
                else:
                    cap.release()
                    cap = None
            else:
                if cap:
                    cap.release()
                    cap = None
                        
        except Exception as e:
            print(json.dumps({"warning": f"camera_{camera_id}_failed: {str(e)}"}), flush=True)
            if cap:
                cap.release()
                cap = None
            continue
    
    if not camera_found or not cap:
        print(json.dumps({"error": "no_camera_found"}), flush=True)
        return None
        
    return cap

def set_camera_properties_safely(cap):
    """Set camera properties with error handling"""
    if not cap:
        return False
        
    try:
        # Try to set properties, but don't fail if they can't be set
        properties = [
            (cv2.CAP_PROP_FRAME_WIDTH, 640),
            (cv2.CAP_PROP_FRAME_HEIGHT, 480),
            (cv2.CAP_PROP_FPS, 30),
            (cv2.CAP_PROP_BUFFERSIZE, 1)
        ]
        
        for prop, value in properties:
            try:
                cap.set(prop, value)
            except Exception:
                pass  # Ignore property setting errors
                
        return True
    except Exception:
        return False

def main():
    try:
        # Parse command line arguments
        parser = argparse.ArgumentParser(description='Eye Blink Counter')
        parser.add_argument('--stream-video', action='store_true', 
                           help='Stream video frames as base64 encoded data')
        args = parser.parse_args()
        
        print("JSON_START" + json.dumps({"status": "starting"}) + "JSON_END", flush=True)
        
        # Initialize camera with improved error handling
        cap = initialize_camera_safely()
        if not cap:
            sys.exit(1)
        
        print("JSON_START" + json.dumps({"status": "camera_ready"}) + "JSON_END", flush=True)
        
        # Set camera properties safely
        set_camera_properties_safely(cap)
        
        print("JSON_START" + json.dumps({"status": "properties_set"}) + "JSON_END", flush=True)
        
        blink_count = 0
        EAR_THRESH = 0.21  # Threshold for blink detection
        CONSEC_FRAMES = 2  # Frames required to confirm a blink
        frame_counter = 0

        print("JSON_START" + json.dumps({"status": "initializing_mediapipe"}) + "JSON_END", flush=True)
        
        # Create face mesh instance
        face_mesh = mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            static_image_mode=False
        )
        
        print("JSON_START" + json.dumps({"status": "initialized"}) + "JSON_END", flush=True)
        
        frame_count = 0
        last_heartbeat = time.time()
        
        try:
            while True:
                if not cap or not cap.isOpened():
                    print(json.dumps({"error": "camera_disconnected"}), flush=True)
                    break
                    
                ret, frame = cap.read()
                if not ret:
                    print(json.dumps({"error": "frame_read_failed"}), flush=True)
                    break
                
                # Ensure frame has proper dimensions
                if frame is None or frame.size == 0:
                    continue
                    
                frame_count += 1
                
                # Send heartbeat every 5 seconds
                current_time = time.time()
                if current_time - last_heartbeat > 5:
                    print("JSON_START" + json.dumps({"status": "processing", "frame_count": frame_count}) + "JSON_END", flush=True)
                    last_heartbeat = current_time
                    
                # Convert BGR to RGB for MediaPipe
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Process with MediaPipe
                rgb.flags.writeable = False
                results = face_mesh.process(rgb)
                rgb.flags.writeable = True

                if results.multi_face_landmarks:
                    for face_landmarks in results.multi_face_landmarks:
                        # Get frame dimensions
                        h, w, _ = frame.shape
                        
                        # Get eye landmarks
                        left_eye = [(int(face_landmarks.landmark[i].x * w), int(face_landmarks.landmark[i].y * h)) for i in LEFT_EYE]
                        right_eye = [(int(face_landmarks.landmark[i].x * w), int(face_landmarks.landmark[i].y * h)) for i in RIGHT_EYE]
                        
                        # Calculate EAR
                        left_ear = eye_aspect_ratio(left_eye)
                        right_ear = eye_aspect_ratio(right_eye)
                        ear = (left_ear + right_ear) / 2.0
                        
                        # Blink detection logic
                        if ear < EAR_THRESH:
                            frame_counter += 1
                        else:
                            if frame_counter >= CONSEC_FRAMES:
                                blink_count += 1
                            frame_counter = 0
                
                # Prepare output data
                output_data = {"blink_count": blink_count}
                
                # Send blink count update with delimiter
                print("JSON_START" + json.dumps(output_data) + "JSON_END", flush=True)
                
                # Add video frame if streaming is enabled (send separately)
                if args.stream_video:
                    try:
                        # Resize frame for streaming (reduce bandwidth)
                        small_frame = cv2.resize(frame, (320, 240))
                        # Encode frame as JPEG
                        encode_params = [cv2.IMWRITE_JPEG_QUALITY, 70]
                        success, buffer = cv2.imencode('.jpg', small_frame, encode_params)
                        if success:
                            # Convert to base64
                            frame_base64 = base64.b64encode(buffer.tobytes()).decode('utf-8')
                            # Send video frame as separate JSON message with delimiter
                            video_data = {"video_frame": frame_base64}
                            print("JSON_START" + json.dumps(video_data) + "JSON_END", flush=True)
                    except Exception as video_error:
                        # Send error but continue processing
                        error_data = {"warning": f"video_encoding_error: {str(video_error)}"}
                        print("JSON_START" + json.dumps(error_data) + "JSON_END", flush=True)
                
                # Small delay to prevent excessive CPU usage
                time.sleep(0.03)  # ~30 FPS limit
                    
        except KeyboardInterrupt:
            print(json.dumps({"status": "interrupted"}), flush=True)
        except Exception as loop_error:
            print(json.dumps({"error": f"loop_error: {str(loop_error)}"}), flush=True)
                    
    except Exception as e:
        print(json.dumps({"error": f"main_error: {str(e)}"}), flush=True)
    finally:
        try:
            if 'face_mesh' in locals():
                face_mesh.close()
            if 'cap' in locals() and cap:
                cap.release()
            print(json.dumps({"status": "cleanup_complete"}), flush=True)
        except Exception:
            pass

if __name__ == '__main__':
    main() 