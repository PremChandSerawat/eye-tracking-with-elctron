#!/usr/bin/env python3
"""
Simple camera test script to diagnose camera issues
"""

import cv2
import json
import time
import sys

def test_camera():
    """Test camera initialization and basic functionality"""
    print("Testing camera initialization...")
    
    # Test different camera backends
    backends = [
        ("AVFOUNDATION", cv2.CAP_AVFOUNDATION),
        ("ANY", cv2.CAP_ANY),
        ("V4L2", cv2.CAP_V4L2) if hasattr(cv2, 'CAP_V4L2') else None,
        ("GSTREAMER", cv2.CAP_GSTREAMER) if hasattr(cv2, 'CAP_GSTREAMER') else None,
    ]
    
    # Filter out None backends
    backends = [(name, backend) for name, backend in backends if backend is not None]
    
    # Test different camera indices
    camera_indices = [0, 1, 2]
    
    working_cameras = []
    
    for camera_id in camera_indices:
        print(f"\n--- Testing Camera {camera_id} ---")
        
        for backend_name, backend_id in backends:
            print(f"Testing backend: {backend_name}")
            
            try:
                cap = cv2.VideoCapture(camera_id, backend_id)
                
                if cap.isOpened():
                    # Try to read a frame
                    ret, frame = cap.read()
                    
                    if ret and frame is not None and frame.size > 0:
                        height, width = frame.shape[:2]
                        print(f"  ✅ SUCCESS: {width}x{height}")
                        
                        # Test property setting
                        original_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                        original_height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                        
                        width_set = cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                        height_set = cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                        
                        print(f"  Original resolution: {original_width}x{original_height}")
                        print(f"  Width property set: {width_set}")
                        print(f"  Height property set: {height_set}")
                        
                        working_cameras.append({
                            'camera_id': camera_id,
                            'backend': backend_name,
                            'resolution': f"{width}x{height}",
                            'properties_settable': width_set and height_set
                        })
                    else:
                        print(f"  ❌ Could not read frame")
                else:
                    print(f"  ❌ Could not open camera")
                    
                cap.release()
                
            except Exception as e:
                print(f"  ❌ Exception: {e}")
    
    print(f"\n--- SUMMARY ---")
    if working_cameras:
        print(f"Found {len(working_cameras)} working camera(s):")
        for cam in working_cameras:
            print(f"  - Camera {cam['camera_id']} ({cam['backend']}): {cam['resolution']}")
            print(f"    Properties settable: {cam['properties_settable']}")
    else:
        print("❌ No working cameras found")
        print("\nPossible solutions:")
        print("1. Check camera permissions in System Preferences > Security & Privacy > Camera")
        print("2. Make sure no other applications are using the camera")
        print("3. Try disconnecting and reconnecting external cameras")
        print("4. Restart the application")
        return False
    
    return True

def test_opencv_info():
    """Print OpenCV build information"""
    print("\n--- OpenCV Information ---")
    print(f"OpenCV Version: {cv2.__version__}")
    build_info = cv2.getBuildInformation()
    
    # Extract relevant information
    lines = build_info.split('\n')
    relevant_sections = ['Video I/O', 'GUI', 'Media I/O']
    
    current_section = None
    for line in lines:
        line = line.strip()
        if any(section in line for section in relevant_sections):
            current_section = line
            print(f"\n{current_section}:")
        elif current_section and line and ':' in line:
            if any(keyword in line.lower() for keyword in ['avfoundation', 'v4l', 'gstreamer', 'ffmpeg']):
                print(f"  {line}")

if __name__ == "__main__":
    print("🎥 Camera Diagnostic Tool")
    print("=" * 40)
    
    # Test OpenCV info
    test_opencv_info()
    
    # Test cameras
    success = test_camera()
    
    if success:
        print("\n✅ Camera test completed successfully!")
        print("You should be able to run the eye tracker now.")
    else:
        print("\n❌ Camera test failed!")
        print("Please address the issues above before running the eye tracker.")
        sys.exit(1) 