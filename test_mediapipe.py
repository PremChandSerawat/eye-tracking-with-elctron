#!/usr/bin/env python3

import cv2
import mediapipe as mp
import json
import sys
import time

def main():
    print(json.dumps({"status": "starting"}), flush=True)
    
    try:
        # Initialize MediaPipe
        print(json.dumps({"status": "initializing_mediapipe"}), flush=True)
        mp_face_mesh = mp.solutions.face_mesh
        mp_drawing = mp.solutions.drawing_utils
        
        # Create face mesh instance
        face_mesh = mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        print(json.dumps({"status": "mediapipe_initialized"}), flush=True)
        
        # Test camera with MediaPipe
        print(json.dumps({"status": "initializing_camera"}), flush=True)
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print(json.dumps({"status": "error", "message": "Cannot open camera"}), flush=True)
            return
        
        print(json.dumps({"status": "camera_opened"}), flush=True)
        
        # Process a few frames
        for i in range(5):
            ret, frame = cap.read()
            if not ret:
                break
            
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process with MediaPipe
            results = face_mesh.process(rgb_frame)
            
            if results.multi_face_landmarks:
                print(json.dumps({"status": "face_detected", "frame_num": i}), flush=True)
            else:
                print(json.dumps({"status": "no_face", "frame_num": i}), flush=True)
            
            time.sleep(0.2)
        
        cap.release()
        face_mesh.close()
        print(json.dumps({"status": "completed"}), flush=True)
        
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main() 