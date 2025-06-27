# Eye Blink Tracker - Desktop Application

A modern, cross-platform desktop application for real-time eye blink tracking with performance monitoring. Built with **Electron** for maximum compatibility across Windows, macOS, and Linux.

## 🚀 Technology Choice: Electron

**Why Electron?** 
- ✅ **True Cross-Platform**: Single codebase runs on Windows, macOS, and Linux
- ✅ **Modern UI Capabilities**: Full HTML/CSS/JS for innovative, responsive designs
- ✅ **Subprocess Management**: Excellent Node.js integration for managing Python processes
- ✅ **Performance Monitoring**: Native access to system metrics via Node.js APIs
- ✅ **Distribution**: Mature tooling for creating installers, app bundles, and store packages
- ✅ **Security**: Sandboxed architecture with context isolation

## 📋 Core Features

### 1. **Cross-Platform UI**
- **Modern Design**: Innovative, glassmorphic interface with smooth animations
- **Platform-Specific UX**: Native-style menus on macOS, proper window controls on Windows
- **Real-Time Data Display**: Live blink count updates with visual feedback
- **Responsive Layout**: Adapts to different screen sizes and orientations

### 2. **Python Script Integration**
- **Subprocess Management**: Launches and manages `eye_blink_counter.py` as a child process
- **Real-Time Communication**: Captures JSON output from Python script via stdout
- **Error Handling**: Comprehensive error detection and user-friendly feedback
- **Cross-Platform Python Detection**: Automatically finds Python executable on any OS

### 3. **Performance Monitoring**
- **System Metrics**: CPU usage, Memory usage, Energy Impact/Power Usage
- **Python Process Tracking**: Dedicated monitoring of the eye tracking subprocess
- **Platform-Specific Labels**: "Energy Impact (macOS)" vs "Power Usage (Windows)"
- **Color-Coded Indicators**: Visual performance status with warning thresholds
- **Real-Time Updates**: Metrics updated every second

### 4. **Video Display**
- **Separate Video Window**: Python script renders its own OpenCV window (`cv2.imshow`)
- **UI Control**: Desktop app provides control interface while Python handles video
- **Eye Tracking Overlays**: Green dots on detected eye landmarks (handled by Python)
- **Blink Detection**: Real-time EAR (Eye Aspect Ratio) calculation and blink counting

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────  │
│  │  Python Subprocess  │  │  Performance Monitor  │  │  IPC Handler  │
│  │  Management     │  │  (systeminformation) │  │           │
│  └─────────────────┘  └─────────────────┘  └─────────────  │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Electron Renderer Process                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────  │
│  │   Modern UI     │  │   Data Display  │  │  Controls   │
│  │   (HTML/CSS/JS) │  │   (Blink Count) │  │  (Start/Stop)  │
│  └─────────────────┘  └─────────────────┘  └─────────────  │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Python Subprocess                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────  │
│  │   OpenCV        │  │   MediaPipe     │  │  JSON Output  │
│  │   Video Window  │  │   Face Mesh     │  │  (stdout)     │
│  └─────────────────┘  └─────────────────┘  └─────────────  │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Installation & Setup

### Prerequisites
- **Node.js** 16+ and npm
- **Python** 3.7+ with pip
- **Camera** access permissions

### 1. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Run Development Version
```bash
npm run dev
```

### 3. Build for Production
```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build-mac    # macOS
npm run build-win    # Windows
npm run build-linux  # Linux
```

## 📱 Application Distribution

### macOS Distribution
- **Preferred**: Signed and uploaded to **TestFlight**
- **Alternative**: Sandboxed, signed `.app` bundle
- **Entitlements**: App Sandbox enabled with camera access
- **Architecture**: Universal binary (Intel + Apple Silicon)

### Windows Distribution
- **Primary**: MSIX package for Microsoft Store
- **Alternative**: NSIS installer (.exe)
- **Architecture**: x64

### Package Sizes (Estimated)
- **macOS**: ~150MB (Universal binary)
- **Windows**: ~120MB (x64)
- **Linux**: ~110MB (AppImage)

## 🎯 Performance Metrics

### Real-Time Monitoring
- **CPU Usage**: Total system CPU percentage
- **Memory Usage**: System memory consumption in MB
- **Energy Impact** (macOS): Estimated energy consumption (0-100)
- **Power Usage** (Windows): Estimated power consumption in watts
- **Python Process**: Dedicated CPU/Memory tracking for eye tracking subprocess

### Performance Thresholds
- 🟢 **Good**: CPU < 50%, Memory < 60%
- 🟡 **Warning**: CPU 50-80%, Memory 60-80%
- 🔴 **Critical**: CPU > 80%, Memory > 80%

## 🔒 Security Features

### Electron Security
- **Context Isolation**: Renderer process isolated from Node.js
- **Sandboxed Renderer**: No direct access to system APIs
- **IPC Validation**: All inter-process communication validated
- **CSP Headers**: Content Security Policy enabled

### macOS Sandboxing
- **App Sandbox**: Fully sandboxed application
- **Camera Access**: Explicit entitlement for camera usage
- **Hardened Runtime**: Enhanced security features enabled

## 🎨 UI/UX Features

### Platform-Specific Enhancements
- **macOS**: 
  - Traffic light buttons integration
  - Vibrancy effects
  - Native-style title bar
- **Windows**: 
  - Proper window controls
  - Windows 11 design language
  - Accent color integration

### Modern Design Elements
- **Glassmorphic Interface**: Backdrop blur effects
- **Gradient Animations**: Smooth color transitions
- **Responsive Layout**: Grid-based responsive design
- **Dark Theme**: Modern dark color scheme
- **Micro-Interactions**: Button hover effects, loading states

## 🛠️ Development Commands

```bash
# Development
npm run dev          # Run with DevTools
npm start           # Production mode

# Building
npm run build       # Build for current platform
npm run pack        # Package without installer
npm run dist        # Create distribution files

# Platform-specific builds
npm run build-mac   # macOS (.app, .dmg)
npm run build-win   # Windows (.exe, .msi, .appx)
npm run build-linux # Linux (.AppImage, .deb, .rpm)
```

## 📊 Testing Strategy

### Unit Tests (Planned)
- JSON parsing validation
- Performance data collection
- IPC communication handlers
- Error handling scenarios

### Integration Tests (Planned)
- Python subprocess lifecycle
- Real-time data flow
- Cross-platform compatibility
- Performance monitoring accuracy

## 🔄 CI/CD Pipeline (Conceptual)

```yaml
# GitHub Actions Workflow
name: Build & Deploy
on: [push, pull_request]

jobs:
  test:
    - Unit tests
    - Integration tests
    - Linting & formatting
    
  build:
    matrix:
      os: [windows-latest, macos-latest, ubuntu-latest]
    steps:
      - Checkout code
      - Setup Node.js & Python
      - Install dependencies
      - Run tests
      - Build application
      - Upload artifacts
      
  deploy:
    - Sign macOS builds
    - Upload to TestFlight
    - Create GitHub releases
    - Deploy to distribution channels
```

## 🐛 Error Handling

### Comprehensive Error Detection
- **Python Not Found**: Clear installation instructions
- **Camera Access Denied**: Permission request guidance
- **Subprocess Crashes**: Automatic restart options
- **Performance Issues**: Resource usage warnings
- **Network Connectivity**: Offline mode capabilities

### User-Friendly Feedback
- **Status Indicators**: Visual system state representation
- **Error Messages**: Clear, actionable error descriptions
- **Loading States**: Progress indicators for all operations
- **Recovery Options**: Automatic retry mechanisms

## 📞 Support & Distribution

### Test Distribution
- **Email**: Send TestFlight invitations to:
  - `ishaan80@gmail.com`
  - `mehul.bhardwaj@outlook.com`

### System Requirements
- **macOS**: 10.15+ (Catalina or later)
- **Windows**: Windows 10 version 1903+
- **Linux**: Ubuntu 18.04+, Fedora 32+, or equivalent
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 200MB available space

---

## 🎯 Project Goals Achievement

✅ **Cross-Platform UI**: Modern Electron app with platform-specific enhancements  
✅ **Python Integration**: Subprocess management with real-time JSON communication  
✅ **Performance Monitoring**: Live system metrics with platform-specific labels  
✅ **Video Display**: Separate OpenCV window controlled by desktop UI  
✅ **Distribution Ready**: Proper packaging for Windows (MSIX) and macOS (TestFlight)  
✅ **Error Handling**: Comprehensive error detection and user feedback  
✅ **Modern Design**: Innovative UI with glassmorphic effects and smooth animations  

This application successfully bridges the gap between the powerful Python-based eye tracking capabilities and a modern, user-friendly desktop experience. 