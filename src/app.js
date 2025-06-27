class EyeBlinkTrackerApp {
    constructor() {
        this.isTracking = false;
        this.currentBlinkCount = 0;
        this.performanceData = null;
        this.isVideoStreaming = false;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fpsUpdateInterval = null;
        
        // Blink rate monitoring
        this.blinkHistory = [];
        this.blinkRateCheckInterval = null;
        this.lastBlinkNotification = 0;
        this.notificationCooldown = 30000; // 30 seconds between notifications
        
        // Session tracking for history
        this.sessionStartTime = null;
        this.chartInstance = null;
        this.lastBlinkRate = 0;
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeApp();
    }

    initializeElements() {
        // Control elements
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.showVideoBtn = document.getElementById('showVideoBtn');
        this.showHistoryBtn = document.getElementById('showHistoryBtn');
        this.startBtnText = document.getElementById('startBtnText');
        this.startSpinner = document.getElementById('startSpinner');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.errorMessage = document.getElementById('errorMessage');

        // Display elements
        this.blinkCount = document.getElementById('blinkCount');
        this.cpuUsage = document.getElementById('cpuUsage');
        this.memoryUsage = document.getElementById('memoryUsage');
        this.energyUsage = document.getElementById('energyUsage');
        this.energyLabel = document.getElementById('energyLabel');
        this.pythonMetrics = document.getElementById('pythonMetrics');
        this.pythonUsage = document.getElementById('pythonUsage');
        this.platformBadge = document.getElementById('platformBadge');
        this.appContainer = document.getElementById('appContainer');

        // Video elements
        this.videoContainer = document.getElementById('videoContainer');
        this.videoNotice = document.getElementById('videoNotice');
        this.videoCanvas = document.getElementById('videoCanvas');
        this.videoStatus = document.getElementById('videoStatus');
        this.fpsCounter = document.getElementById('fpsCounter');
        this.resolutionInfo = document.getElementById('resolutionInfo');
        this.videoCtx = this.videoCanvas.getContext('2d');
        
        // History modal elements
        this.historyModal = document.getElementById('historyModal');
        this.historyCloseBtn = document.getElementById('historyCloseBtn');
        this.blinkChart = document.getElementById('blinkChart');
        this.sessionDuration = document.getElementById('sessionDuration');
        this.totalBlinks = document.getElementById('totalBlinks');
        this.avgBlinkRate = document.getElementById('avgBlinkRate');
        this.currentBlinkRate = document.getElementById('currentBlinkRate');
        this.exportDataBtn = document.getElementById('exportDataBtn');
        this.refreshChartBtn = document.getElementById('refreshChartBtn');
    }

    setupEventListeners() {
        // Control button events
        this.startBtn.addEventListener('click', () => this.startTracking());
        this.stopBtn.addEventListener('click', () => this.stopTracking());
        this.showVideoBtn.addEventListener('click', () => this.toggleVideoDisplay());
        this.showHistoryBtn.addEventListener('click', () => this.showBlinkHistory());

        // Python process events
        window.electronAPI.onPythonStatus((status) => {
            console.log('Python status:', status);
            this.handlePythonStatus(status);
        });

        window.electronAPI.onPythonError((error) => {
            console.error('Python error:', error);
            this.showError(`Python Error: ${error}`);
        });

        // New event handlers for data
        window.electronAPI.onBlinkCount((count) => {
            console.log('Received blink count:', count);
            this.updateBlinkCount(count);
        });

        window.electronAPI.onVideoFrame((frameData) => {
            console.log('Received video frame, length:', frameData?.length || 'unknown');
            this.updateVideoFrame(frameData);
        });

        window.electronAPI.onPythonData((data) => {
            console.log('Received python data:', data);
            this.handlePythonData(data);
        });

        // Performance monitoring
        window.electronAPI.onPerformanceData((data) => {
            this.updatePerformanceData(data);
        });

        // Settings
        window.electronAPI.onSettingsUpdate((settings) => {
            this.updateSettings(settings);
        });

        // IPC listeners
        window.electronAPI.onPythonStopped((event, data) => {
            this.handlePythonStopped(data.code);
        });

        window.electronAPI.onCameraNotFound((event, data) => {
            this.showCameraNotification(data);
        });

        // Keyboard shortcuts
        // History modal event listeners
        this.historyCloseBtn.addEventListener('click', () => this.hideBlinkHistory());
        this.exportDataBtn.addEventListener('click', () => this.exportBlinkData());
        this.refreshChartBtn.addEventListener('click', () => this.updateChart());

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (this.historyModal.style.display === 'block') {
                    this.hideBlinkHistory();
                } else if (this.isTracking) {
                    this.stopTracking();
                }
            }
        });
        
        // Close history modal when clicking outside
        this.historyModal.addEventListener('click', (event) => {
            if (event.target === this.historyModal) {
                this.hideBlinkHistory();
            }
        });
    }

    async initializeApp() {
        try {
            // Get app info and set platform-specific styles
            const appInfo = await window.electronAPI.getAppInfo();
            this.setupPlatformStyles(appInfo.platform);
            
            // Check permissions first
            await this.checkAllPermissions();
            
            // Check if tracking is already running (instead of auto-starting)
            await this.checkTrackingStatus();
            
            // Initialize performance monitoring
            this.startPerformanceMonitoring();
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application');
        }
    }

    async checkTrackingStatus() {
        try {
            const status = await window.electronAPI.getTrackingStatus();
            if (status.isRunning) {
                this.isTracking = true;
                this.isVideoStreaming = status.hasVideo;
                this.updateStatus('👁️ Eye tracking active (auto-started)', 'running');
                this.updateControlButtons();
                this.pythonMetrics.style.display = 'flex';
                this.showVideoBtn.style.display = 'block';
                
                if (this.isVideoStreaming) {
                    this.videoContainer.style.display = 'block';
                    this.startFPSCounter();
                }
            }
        } catch (error) {
            console.log('Could not check tracking status:', error);
        }
    }

    setupPlatformStyles(platform) {
        // Add platform-specific class
        this.appContainer.classList.add(`platform-${platform}`);
        
        // Update platform badge
        const platformNames = {
            'darwin': 'macOS',
            'win32': 'Windows',
            'linux': 'Linux'
        };
        this.platformBadge.textContent = platformNames[platform] || platform;
        
        // Update energy label based on platform
        if (platform === 'darwin') {
            this.energyLabel.textContent = 'Energy Impact (macOS)';
        } else if (platform === 'win32') {
            this.energyLabel.textContent = 'Power Usage (Windows)';
        } else {
            this.energyLabel.textContent = 'System Load';
        }
    }

    async startTracking() {
        if (this.isTracking) return;

        try {
            this.setStartButtonLoading(true);
            this.updateStatus('Starting Python process...', 'loading');
            this.hideError();

            // Start tracking with video streaming enabled
            const result = await window.electronAPI.startTrackingWithVideo();
            
            if (result.success) {
                this.isTracking = true;
                this.isVideoStreaming = true;
                this.updateStatus('👁️ Eye tracking active', 'running');
                this.updateControlButtons();
                
                // Show Python process metrics
                this.pythonMetrics.style.display = 'flex';
                this.showVideoBtn.style.display = 'block';
                this.showHistoryBtn.style.display = 'block';
                
                // Track session start time
                this.sessionStartTime = Date.now();
                
                // Show video container and start FPS counter
                this.videoContainer.style.display = 'block';
                this.videoNotice.style.display = 'none';
                this.showVideoBtn.textContent = '🙈 Hide Video from UI';
                this.startFPSCounter();
                
                // Start performance monitoring and blink rate monitoring
                this.startPerformanceMonitoring();
                this.startBlinkRateMonitoring();
                
                // Request notification permission if not already granted
                if (Notification.permission !== 'granted') {
                    await this.requestNotificationPermission();
                }
                
            } else {
                throw new Error(result.error || 'Failed to start tracking');
            }
        } catch (error) {
            console.error('Failed to start tracking:', error);
            this.showError(error.message);
            this.updateStatus('Failed to start tracking', 'error');
        } finally {
            this.setStartButtonLoading(false);
        }
    }

    async stopTracking() {
        if (!this.isTracking) return;

        try {
            this.updateStatus('Stopping tracking...', 'loading');
            
            const result = await window.electronAPI.stopTracking();
            
            if (result.success) {
                this.handleTrackingStopped();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to stop tracking:', error);
            this.showError(error.message);
        }
    }

    handleTrackingStopped() {
        this.isTracking = false;
        this.isVideoStreaming = false;
        this.updateStatus('👁️ Eye tracking stopped', 'idle');
        this.updateControlButtons();
        this.setStartButtonLoading(false);
        
        // Hide Python process metrics
        this.pythonMetrics.style.display = 'none';
        
        // Hide video elements and reset button
        this.videoContainer.style.display = 'none';
        this.videoNotice.style.display = 'block';
        this.showVideoBtn.style.display = 'none';
        this.showVideoBtn.textContent = '📹 Show Video in UI';
        this.showHistoryBtn.style.display = 'none';
        
        // Stop FPS counter
        if (this.fpsUpdateInterval) {
            clearInterval(this.fpsUpdateInterval);
            this.fpsUpdateInterval = null;
        }
        
        // Stop blink rate monitoring
        this.stopBlinkRateMonitoring();
    }

    handlePythonStopped(exitCode) {
        this.handleTrackingStopped();
        
        if (exitCode !== 0) {
            this.showError(`Python process exited unexpectedly (code: ${exitCode})`);
            this.updateStatus('Python process crashed', 'error');
        }
    }

    updateBlinkCount(count) {
        if (count !== this.currentBlinkCount) {
            this.currentBlinkCount = count;
            
            // Update display with animation
            this.blinkCount.textContent = count;
            this.blinkCount.classList.add('updated');
            
            setTimeout(() => {
                this.blinkCount.classList.remove('updated');
            }, 300);
        }
        
        // Record blink for rate monitoring
        if (this.isTracking) {
            this.recordBlink(count);
        }
    }

    updatePerformanceData(data) {
        this.performanceData = data;
        
        // Update CPU usage
        this.cpuUsage.textContent = `${data.cpu}%`;
        
        // Update memory usage
        this.memoryUsage.textContent = `${data.memory} MB`;
        
        // Update energy/power usage
        let energyText = '';
        if (data.platform === 'darwin') {
            energyText = `${data.energyImpact}`;
        } else if (data.platform === 'win32') {
            energyText = `${data.energyImpact}W`;
        } else {
            energyText = `${data.energyImpact}%`;
        }
        this.energyUsage.textContent = energyText;
        
        // Update Python process metrics if tracking
        if (this.isTracking && data.pythonCpu !== undefined) {
            this.pythonUsage.textContent = `${data.pythonCpu}% / ${data.pythonMemory}MB`;
        }
        
        // Update status colors based on usage
        this.updatePerformanceColors(data);
    }

    updatePerformanceColors(data) {
        // Color code performance metrics
        const cpuElement = this.cpuUsage;
        const memoryElement = this.memoryUsage;
        
        // CPU color coding
        if (data.cpu > 80) {
            cpuElement.style.color = 'var(--danger-color)';
        } else if (data.cpu > 50) {
            cpuElement.style.color = 'var(--warning-color)';
        } else {
            cpuElement.style.color = 'var(--success-color)';
        }
        
        // Memory color coding
        const memoryPercentage = (data.memory / data.totalMemory) * 100;
        if (memoryPercentage > 80) {
            memoryElement.style.color = 'var(--danger-color)';
        } else if (memoryPercentage > 60) {
            memoryElement.style.color = 'var(--warning-color)';
        } else {
            memoryElement.style.color = 'var(--success-color)';
        }
    }

    startPerformanceMonitoring() {
        // Initial performance data fetch
        this.fetchPerformanceData();
        
        // Set up periodic updates (backup to main process updates)
        setInterval(() => {
            this.fetchPerformanceData();
        }, 5000); // Every 5 seconds as backup
    }

    async fetchPerformanceData() {
        try {
            const data = await window.electronAPI.getPerformance();
            if (data) {
                this.updatePerformanceData(data);
            }
        } catch (error) {
            console.error('Failed to fetch performance data:', error);
        }
    }

    setStartButtonLoading(loading) {
        if (loading) {
            this.startBtnText.textContent = 'Starting...';
            this.startSpinner.style.display = 'block';
            this.startBtn.disabled = true;
        } else {
            this.startBtnText.textContent = 'Start Tracking';
            this.startSpinner.style.display = 'none';
            this.startBtn.disabled = this.isTracking;
        }
    }

    updateControlButtons() {
        this.startBtn.disabled = this.isTracking;
        this.stopBtn.disabled = !this.isTracking;
    }

    updateStatus(message, type = 'idle') {
        this.statusIndicator.textContent = message;
        this.statusIndicator.className = `status-indicator status-${type}`;
    }

    showCameraNotification(data) {
        // Create a custom notification for camera issues
        const notification = document.createElement('div');
        notification.className = 'camera-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-header">
                    <span class="notification-title">${data.title}</span>
                    <button class="notification-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="notification-message">${data.message.replace(/\n/g, '<br>')}</div>
                <div class="notification-actions">
                    <button class="btn btn-primary" onclick="window.electronAPI.openCameraSettings()">⚙️ Camera Settings</button>
                    <button class="btn btn-primary" onclick="location.reload()">🔄 Retry</button>
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Dismiss</button>
                </div>
            </div>
        `;
        
        // Add styles for the notification
        if (!document.getElementById('camera-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'camera-notification-styles';
            styles.textContent = `
                .camera-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #1e293b, #334155);
                    border: 1px solid #ef4444;
                    border-radius: 12px;
                    padding: 0;
                    max-width: 400px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    z-index: 10000;
                    animation: slideInRight 0.3s ease-out;
                }
                
                .notification-content {
                    padding: 20px;
                }
                
                .notification-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                
                .notification-title {
                    color: #ef4444;
                    font-weight: 600;
                    font-size: 16px;
                }
                
                .notification-close {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                }
                
                .notification-close:hover {
                    background-color: rgba(148, 163, 184, 0.1);
                }
                
                .notification-message {
                    color: #cbd5e1;
                    line-height: 1.5;
                    margin-bottom: 16px;
                    font-size: 14px;
                }
                
                .notification-actions {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                }
                
                .notification-actions .btn {
                    padding: 8px 16px;
                    font-size: 14px;
                }
                
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(styles);
        }
        
        // Remove any existing camera notifications
        const existingNotifications = document.querySelectorAll('.camera-notification');
        existingNotifications.forEach(n => n.remove());
        
        // Add the notification to the page
        document.body.appendChild(notification);
        
        // Auto-remove after 30 seconds (more time for camera settings)
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 30000);
        
        // Also show in the regular error area
        this.showError('Camera not found. Please check the notification for details.');
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        
        // Auto-hide error after 10 seconds
        setTimeout(() => {
            this.hideError();
        }, 10000);
    }

    hideError() {
        this.errorMessage.style.display = 'none';
        this.errorMessage.textContent = '';
    }

    async startVideoStreaming() {
        if (this.isVideoStreaming) return;

        try {
            // The Python process is already running with video streaming
            // We just need to show the video container
            this.isVideoStreaming = true;
            this.updateStatus('👁️ Video streaming active', 'running');
            
            // Show video container and hide notice
            this.videoContainer.style.display = 'block';
            this.videoNotice.style.display = 'none';
            
            // Hide show video button
            this.showVideoBtn.style.display = 'none';
            
            // Update video status
            this.videoStatus.textContent = 'Connecting...';
            this.videoStatus.className = 'video-status connecting';
            
            // Start FPS counter
            this.startFPSCounter();
            
        } catch (error) {
            console.error('Failed to start video streaming:', error);
            this.showError(error.message);
            this.updateStatus('Failed to start video mode', 'error');
        }
    }

    displayVideoFrame(frameBase64, timestamp) {
        if (!this.isVideoStreaming) return;

        const img = new Image();
        img.onload = () => {
            try {
                // Update canvas size if needed
                if (this.videoCanvas.width !== img.width || this.videoCanvas.height !== img.height) {
                    this.videoCanvas.width = img.width;
                    this.videoCanvas.height = img.height;
                    this.resolutionInfo.textContent = `${img.width}x${img.height}`;
                }
                
                // Clear canvas and draw frame
                this.videoCtx.clearRect(0, 0, this.videoCanvas.width, this.videoCanvas.height);
                this.videoCtx.drawImage(img, 0, 0);
                
                // Update status to connected
                if (this.videoStatus.textContent === 'Connecting...') {
                    this.videoStatus.textContent = 'Live';
                    this.videoStatus.className = 'video-status';
                }
                
                // Update frame count for FPS calculation
                this.frameCount++;
            } catch (drawError) {
                console.error('Error drawing video frame:', drawError);
                this.videoStatus.textContent = 'Display Error';
                this.videoStatus.className = 'video-status error';
            }
        };
        
        img.onerror = (error) => {
            console.error('Failed to load video frame:', error);
            this.videoStatus.textContent = 'Error';
            this.videoStatus.className = 'video-status error';
        };
        
        // Set image source with proper base64 data URL
        try {
            img.src = `data:image/jpeg;base64,${frameBase64}`;
        } catch (srcError) {
            console.error('Error setting image source:', srcError);
            this.videoStatus.textContent = 'Source Error';
            this.videoStatus.className = 'video-status error';
        }
    }

    startFPSCounter() {
        this.frameCount = 0;
        this.lastFrameTime = Date.now();
        
        this.fpsUpdateInterval = setInterval(() => {
            const now = Date.now();
            const elapsed = (now - this.lastFrameTime) / 1000;
            const fps = Math.round(this.frameCount / elapsed);
            
            this.fpsCounter.textContent = `FPS: ${fps}`;
            
            // Reset counters
            this.frameCount = 0;
            this.lastFrameTime = now;
        }, 1000);
    }

    handlePythonStatus(status) {
        if (status === 'initialized') {
            this.updateStatus('👁️ Eye tracking initialized', 'running');
        }
    }

    updateVideoFrame(frameData) {
        // Handle video frame data - it comes as a base64 string directly
        if (typeof frameData === 'string' && frameData.length > 0) {
            console.log('Displaying video frame, length:', frameData.length);
            this.displayVideoFrame(frameData, Date.now());
        } else if (frameData && frameData.frame) {
            this.displayVideoFrame(frameData.frame, frameData.timestamp || Date.now());
        } else {
            console.warn('Invalid video frame data:', frameData ? 'data received but invalid format' : 'no data');
        }
    }

    handlePythonData(data) {
        // Handle additional data from Python process
        console.log('Python data:', data);
    }

    updateSettings(settings) {
        // Handle settings update
        console.log('Settings updated:', settings);
    }

    toggleVideoDisplay() {
        // Check if video container is currently visible
        const isVideoVisible = this.videoContainer.style.display !== 'none';
        
        if (isVideoVisible) {
            // Hide video, show notice
            this.videoContainer.style.display = 'none';
            this.videoNotice.style.display = 'block';
            this.showVideoBtn.textContent = '📹 Show Video in UI';
        } else {
            // Show video, hide notice
            this.videoContainer.style.display = 'block';
            this.videoNotice.style.display = 'none';
            this.showVideoBtn.textContent = '🙈 Hide Video from UI';
        }
    }

    // Blink rate monitoring functions
    startBlinkRateMonitoring() {
        console.log('🚀 Starting blink rate monitoring...');
        
        // Clear any existing interval
        if (this.blinkRateCheckInterval) {
            clearInterval(this.blinkRateCheckInterval);
        }
        
        // Check blink rate every 1 minute (60 seconds) as requested
        this.blinkRateCheckInterval = setInterval(() => {
            this.checkBlinkRate();
        }, 60000);
        
        // Also do an initial check after 10 seconds for faster debugging
        setTimeout(() => {
            console.log('⏰ Running initial blink rate check after 10 seconds (debug mode)...');
            this.checkBlinkRate();
        }, 10000);
        
        // Add more frequent checks for debugging (every 15 seconds)
        setInterval(() => {
            console.log('🔄 Debug check...');
            this.checkBlinkRate();
        }, 15000);
        
        console.log('✅ Blink rate monitoring started successfully');
    }
    
    stopBlinkRateMonitoring() {
        if (this.blinkRateCheckInterval) {
            clearInterval(this.blinkRateCheckInterval);
            this.blinkRateCheckInterval = null;
        }
        this.blinkHistory = [];
    }
    
    recordBlink(blinkCount) {
        const now = Date.now();
        
        // Add current blink count with timestamp
        this.blinkHistory.push({
            count: blinkCount,
            timestamp: now
        });
        
        console.log(`📝 Recorded blink: count=${blinkCount}, total history length=${this.blinkHistory.length}`);
        
        // Remove entries older than 1 minute
        this.blinkHistory = this.blinkHistory.filter(entry => 
            now - entry.timestamp <= 60000
        );
    }
    
    checkBlinkRate() {
        console.log('🔍 Checking blink rate...');
        console.log('Blink history length:', this.blinkHistory.length);
        
        if (this.blinkHistory.length < 2) {
            console.log('❌ Not enough blink history data');
            return;
        }
        
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Get blinks from the last minute
        const recentBlinks = this.blinkHistory.filter(entry => 
            entry.timestamp >= oneMinuteAgo
        );
        
        console.log('Recent blinks in last minute:', recentBlinks.length);
        
        if (recentBlinks.length === 0) {
            console.log('❌ No recent blinks found');
            return;
        }
        
        // Calculate blinks per minute
        const oldestBlink = recentBlinks[0];
        const newestBlink = recentBlinks[recentBlinks.length - 1];
        const blinkDifference = newestBlink.count - oldestBlink.count;
        const timeDifference = newestBlink.timestamp - oldestBlink.timestamp;
        
        // Extrapolate to blinks per minute
        const blinksPerMinute = timeDifference > 0 ? 
            Math.round((blinkDifference / timeDifference) * 60000) : 0;
        
        console.log(`📊 Calculated blink rate: ${blinksPerMinute}/min`);
        console.log(`Time difference: ${timeDifference}ms, Blink difference: ${blinkDifference}`);
        
        // Store the last calculated blink rate
        this.lastBlinkRate = blinksPerMinute;
        
        // Check if blink rate is too low and show notification
        // Temporarily using 20 instead of 15 for easier testing
        if (blinksPerMinute < 20 && blinksPerMinute > 0) {
            console.log('🚨 Low blink rate detected! Showing notification...');
            this.showLowBlinkRateNotification(blinksPerMinute);
        } else {
            console.log(`✅ Blink rate is normal: ${blinksPerMinute}/min (threshold: 20 for testing)`);
        }
    }
    
    showLowBlinkRateNotification(blinksPerMinute) {
        console.log(`🔔 showLowBlinkRateNotification called with ${blinksPerMinute} blinks/min`);
        
        const now = Date.now();
        
        // Check cooldown period
        if (now - this.lastBlinkNotification < this.notificationCooldown) {
            console.log('⏳ Notification in cooldown period, skipping...');
            return;
        }
        
        this.lastBlinkNotification = now;
        console.log('✅ Proceeding with notification...');
        
        // Show browser notification if permission granted
        if (Notification.permission === 'granted') {
            new Notification('👁️ Low Blink Rate Alert', {
                body: `You blinked only ${blinksPerMinute} times in the last minute. Normal rate is 15-20/min. Take a break and blink more frequently to prevent eye strain!`,
                icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDlDMTMuNjU2OSA5IDE1IDEwLjM0MzEgMTUgMTJDMTUgMTMuNjU2OSAxMy42NTY5IDE1IDEyIDE1QzEwLjM0MzEgMTUgOSAxMy42NTY5IDkgMTJDOSAxMC4zNDMxIDEwLjM0MzEgOSAxMiA5WiIgZmlsbD0iIzMzNzNkYyIvPgo8cGF0aCBkPSJNMTIgNUMxNy4xOTI0IDUgMjEuMjc3NCA4LjI2NTE2IDIyLjY0MTMgMTJDMjEuMjc3NCAxNS43MzQ4IDE3LjE5MjQgMTkgMTIgMTlDNi44MDc2MSAxOSAyLjcyMjYzIDE1LjczNDggMS4zNTg3IDEyQzIuNzIyNjMgOC4yNjUxNiA2LjgwNzYxIDUgMTIgNVoiIHN0cm9rZT0iIzMzNzNkYyIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+',
                tag: 'blink-rate-alert'
            });
        }
        
        // Show in-app notification
        this.showInAppNotification(
            `⚠️ Low Blink Rate: ${blinksPerMinute}/min`, 
            'You blinked less than 15 times in the last minute. Normal rate is 15-20/min. Consider taking a break to prevent eye strain!',
            'warning'
        );
    }
    
    showInAppNotification(title, message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        // Add to DOM
        document.body.appendChild(notification);
        
        // Add close functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 8000);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
    }
    
    // Request notification permission
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('Notification permission:', permission);
        }
        console.log('Current notification permission:', Notification.permission);
    }
    
    // Test notification function (for debugging)
    testNotification() {
        console.log('🧪 Testing notification system...');
        this.showLowBlinkRateNotification(10); // Test with 10 blinks per minute
    }
    
    // Check all required permissions
    async checkAllPermissions() {
        console.log('🔐 Checking all permissions...');
        
        const permissions = {
            camera: await this.checkCameraPermission(),
            notifications: await this.checkNotificationPermission()
        };
        
        console.log('Permission status:', permissions);
        
        // Show permission dialog if any permissions are missing
        if (!permissions.camera || !permissions.notifications) {
            await this.showPermissionDialog(permissions);
        }
        
        return permissions;
    }
    
    // Check camera permission
    async checkCameraPermission() {
        try {
            // Try to get user media to check camera access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: false 
            });
            
            // Stop the stream immediately - we just needed to check permission
            stream.getTracks().forEach(track => track.stop());
            
            console.log('✅ Camera permission: granted');
            return true;
        } catch (error) {
            console.log('❌ Camera permission: denied or not available');
            console.log('Camera error:', error.message);
            return false;
        }
    }
    
    // Check notification permission
    async checkNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('❌ Notifications not supported');
            return false;
        }
        
        const permission = Notification.permission;
        console.log('📢 Notification permission:', permission);
        
        return permission === 'granted';
    }
    
    // Show permission dialog
    async showPermissionDialog(permissions) {
        const missingPermissions = [];
        
        if (!permissions.camera) {
            missingPermissions.push('Camera access for eye tracking');
        }
        
        if (!permissions.notifications) {
            missingPermissions.push('Notifications for blink rate alerts');
        }
        
        // Create permission dialog
        const dialog = document.createElement('div');
        dialog.className = 'permission-dialog';
        dialog.innerHTML = `
            <div class="permission-dialog-overlay">
                <div class="permission-dialog-content">
                    <div class="permission-header">
                        <h2>👁️ Permissions Required</h2>
                        <p>Eye Blink Tracker needs the following permissions to work properly:</p>
                    </div>
                    
                    <div class="permission-list">
                        ${missingPermissions.map(permission => `
                            <div class="permission-item">
                                <span class="permission-icon">${permission.includes('Camera') ? '📹' : '🔔'}</span>
                                <span class="permission-text">${permission}</span>
                                <span class="permission-status">❌ Not granted</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="permission-explanation">
                        <p><strong>Why we need these permissions:</strong></p>
                        <ul>
                            ${!permissions.camera ? '<li><strong>Camera:</strong> Required to detect your eye movements and count blinks</li>' : ''}
                            ${!permissions.notifications ? '<li><strong>Notifications:</strong> Alerts you when your blink rate is too low to prevent eye strain</li>' : ''}
                        </ul>
                    </div>
                    
                    <div class="permission-actions">
                        <button class="btn btn-primary" id="grantPermissionsBtn">Grant Permissions</button>
                        <button class="btn btn-secondary" id="continueWithoutBtn">Continue Without Permissions</button>
                    </div>
                    
                    <div class="permission-note">
                        <small>You can change these permissions later in your browser settings.</small>
                    </div>
                </div>
            </div>
        `;
        
        // Add to DOM
        document.body.appendChild(dialog);
        
        // Add event listeners
        const grantBtn = dialog.querySelector('#grantPermissionsBtn');
        const continueBtn = dialog.querySelector('#continueWithoutBtn');
        
        return new Promise((resolve) => {
            grantBtn.addEventListener('click', async () => {
                await this.requestAllPermissions();
                dialog.remove();
                resolve();
            });
            
            continueBtn.addEventListener('click', () => {
                dialog.remove();
                this.showInAppNotification(
                    '⚠️ Limited Functionality', 
                    'Some features may not work without proper permissions.',
                    'warning'
                );
                resolve();
            });
        });
    }
    
    // Request all permissions
    async requestAllPermissions() {
        const results = {
            camera: false,
            notifications: false
        };
        
        // Request camera permission
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: false 
            });
            stream.getTracks().forEach(track => track.stop());
            results.camera = true;
            console.log('✅ Camera permission granted');
        } catch (error) {
            console.log('❌ Camera permission denied:', error.message);
            this.showInAppNotification(
                '📹 Camera Access Required', 
                'Please enable camera access in your browser settings to use eye tracking.',
                'warning'
            );
        }
        
        // Request notification permission
        if ('Notification' in window) {
            try {
                const permission = await Notification.requestPermission();
                results.notifications = permission === 'granted';
                
                if (results.notifications) {
                    console.log('✅ Notification permission granted');
                    // Show a test notification
                    new Notification('👁️ Eye Blink Tracker', {
                        body: 'Notifications are now enabled! You\'ll receive alerts for low blink rates.',
                        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDlDMTMuNjU2OSA5IDE1IDEwLjM0MzEgMTUgMTJDMTUgMTMuNjU2OSAxMy42NTY5IDE1IDEyIDE1QzEwLjM0MzEgMTUgOSAxMy42NTY5IDkgMTJDOSAxMC4zNDMxIDEwLjM0MzEgOSAxMiA5WiIgZmlsbD0iIzMzNzNkYyIvPgo8cGF0aCBkPSJNMTIgNUMxNy4xOTI0IDUgMjEuMjc3NCA4LjI2NTE2IDIyLjY0MTMgMTJDMjEuMjc3NCAxNS43MzQ4IDE3LjE5MjQgMTkgMTIgMTlDNi44MDc2MSAxOSAyLjcyMjYzIDE1LjczNDggMS4zNTg3IDEyQzIuNzIyNjMgOC4yNjUxNiA2LjgwNzYxIDUgMTIgNVoiIHN0cm9rZT0iIzMzNzNkYyIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+',
                        tag: 'permission-granted'
                    });
                } else {
                    console.log('❌ Notification permission denied');
                    this.showInAppNotification(
                        '🔔 Notifications Blocked', 
                        'Please enable notifications in your browser settings to receive blink rate alerts.',
                        'warning'
                    );
                }
            } catch (error) {
                console.log('❌ Notification permission error:', error);
            }
        }
        
        return results;
    }
    
    // Blink History Functions
    showBlinkHistory() {
        console.log('📊 Showing blink history...');
        this.historyModal.style.display = 'block';
        this.updateHistoryStats();
        this.createChart();
    }
    
    hideBlinkHistory() {
        this.historyModal.style.display = 'none';
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
    }
    
    updateHistoryStats() {
        // Calculate session duration
        const now = Date.now();
        const sessionDuration = this.sessionStartTime ? 
            Math.round((now - this.sessionStartTime) / 60000) : 0;
        
        // Calculate average blink rate
        const totalDataPoints = this.blinkHistory.length;
        let avgRate = 0;
        
        if (totalDataPoints > 1) {
            const oldestEntry = this.blinkHistory[0];
            const newestEntry = this.blinkHistory[totalDataPoints - 1];
            const totalTime = newestEntry.timestamp - oldestEntry.timestamp;
            const totalBlinks = newestEntry.count - oldestEntry.count;
            
            if (totalTime > 0) {
                avgRate = Math.round((totalBlinks / totalTime) * 60000);
            }
        }
        
        // Update stats display
        this.sessionDuration.textContent = `${sessionDuration} min`;
        this.totalBlinks.textContent = this.currentBlinkCount;
        this.avgBlinkRate.textContent = `${avgRate}/min`;
        this.currentBlinkRate.textContent = `${this.lastBlinkRate}/min`;
    }
    
    createChart() {
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }
        
        // Prepare data for the chart
        const chartData = this.prepareChartData();
        
        const ctx = this.blinkChart.getContext('2d');
        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Blinks per Minute',
                    data: chartData.blinkRates,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }, {
                    label: 'Cumulative Blinks',
                    data: chartData.cumulativeBlinks,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Blink Rate Over Time',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        color: '#e2e8f0'
                    },
                    legend: {
                        labels: {
                            color: '#e2e8f0'
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time',
                            color: '#94a3b8'
                        },
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.2)'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Blinks per Minute',
                            color: '#94a3b8'
                        },
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.2)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Total Blinks',
                            color: '#94a3b8'
                        },
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            drawOnChartArea: false,
                            color: 'rgba(148, 163, 184, 0.2)'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }
    
    prepareChartData() {
        const labels = [];
        const blinkRates = [];
        const cumulativeBlinks = [];
        
        if (this.blinkHistory.length < 2) {
            return { labels, blinkRates, cumulativeBlinks };
        }
        
        // Group data by time intervals (every 30 seconds)
        const intervalMs = 30000; // 30 seconds
        const startTime = this.blinkHistory[0].timestamp;
        const endTime = this.blinkHistory[this.blinkHistory.length - 1].timestamp;
        
        for (let time = startTime; time <= endTime; time += intervalMs) {
            // Find blinks in this interval
            const intervalStart = time;
            const intervalEnd = time + intervalMs;
            
            const blinksInInterval = this.blinkHistory.filter(entry => 
                entry.timestamp >= intervalStart && entry.timestamp < intervalEnd
            );
            
            if (blinksInInterval.length > 0) {
                // Calculate time label
                const elapsedMinutes = Math.round((time - startTime) / 60000);
                labels.push(`${elapsedMinutes}m`);
                
                // Calculate blink rate for this interval
                const firstBlink = blinksInInterval[0];
                const lastBlink = blinksInInterval[blinksInInterval.length - 1];
                const blinkDiff = lastBlink.count - firstBlink.count;
                const timeDiff = lastBlink.timestamp - firstBlink.timestamp;
                
                const rate = timeDiff > 0 ? Math.round((blinkDiff / timeDiff) * 60000) : 0;
                blinkRates.push(rate);
                cumulativeBlinks.push(lastBlink.count);
            }
        }
        
        return { labels, blinkRates, cumulativeBlinks };
    }
    
    updateChart() {
        if (this.chartInstance) {
            const chartData = this.prepareChartData();
            this.chartInstance.data.labels = chartData.labels;
            this.chartInstance.data.datasets[0].data = chartData.blinkRates;
            this.chartInstance.data.datasets[1].data = chartData.cumulativeBlinks;
            this.chartInstance.update();
        }
        this.updateHistoryStats();
    }
    
    exportBlinkData() {
        if (this.blinkHistory.length === 0) {
            this.showInAppNotification(
                '📁 No Data to Export',
                'Start tracking to collect blink data first.',
                'info'
            );
            return;
        }
        
        // Prepare CSV data
        const csvHeader = 'Timestamp,DateTime,BlinkCount,ElapsedMinutes\n';
        const csvRows = this.blinkHistory.map(entry => {
            const date = new Date(entry.timestamp);
            const elapsedMinutes = this.sessionStartTime ? 
                Math.round((entry.timestamp - this.sessionStartTime) / 60000) : 0;
            
            return `${entry.timestamp},${date.toISOString()},${entry.count},${elapsedMinutes}`;
        }).join('\n');
        
        const csvContent = csvHeader + csvRows;
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `blink_data_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showInAppNotification(
            '📁 Data Exported',
            'Blink data has been exported to CSV file.',
            'info'
        );
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if electronAPI is available
    if (typeof window.electronAPI === 'undefined') {
        console.error('Electron API not available');
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 20px;">
                <div>
                    <h1 style="color: #ef4444; margin-bottom: 16px;">⚠️ Electron API Error</h1>
                    <p style="color: #cbd5e1;">This application must be run through Electron.</p>
                    <p style="color: #64748b; font-size: 14px; margin-top: 12px;">Please run: npm start</p>
                </div>
            </div>
        `;
        return;
    }
    
    // Initialize the app
    const app = new EyeBlinkTrackerApp();
    
    // Make app globally accessible for debugging
    window.eyeBlinkApp = app;
    
    console.log('Eye Blink Tracker App initialized successfully');
}); 