#!/usr/bin/env python3

import cv2
import json
import sys
import time

def main():
    print(json.dumps({"status": "starting"}), flush=True)
    
    try:
        # Test camera initialization
        print(json.dumps({"status": "initializing_camera"}), flush=True)
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print(json.dumps({"status": "error", "message": "Cannot open camera"}), flush=True)
            return
        
        print(json.dumps({"status": "camera_opened"}), flush=True)
        
        # Test reading a frame
        ret, frame = cap.read()
        if not ret:
            print(json.dumps({"status": "error", "message": "Cannot read frame"}), flush=True)
            cap.release()
            return
        
        print(json.dumps({"status": "frame_read", "frame_shape": frame.shape}), flush=True)
        
        # Test for a few seconds
        for i in range(10):
            ret, frame = cap.read()
            if not ret:
                break
            print(json.dumps({"status": "processing", "frame_num": i}), flush=True)
            time.sleep(0.1)
        
        cap.release()
        print(json.dumps({"status": "completed"}), flush=True)
        
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main() 