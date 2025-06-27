const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const si = require('systeminformation');
const pidusage = require('pidusage');

let mainWindow;
let pythonProcess = null;
let performanceInterval = null;
let pythonProcessPid = null;
let isAppClosing = false;

// Performance monitoring data
let performanceData = {
    cpu: 0,
    memory: 0,
    energyImpact: 0,
    timestamp: Date.now()
};

function createWindow() {
    // Create the browser window with modern design
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        frame: process.platform !== 'darwin',
        show: false,
        backgroundColor: '#1a1a1a',
        vibrancy: process.platform === 'darwin' ? 'under-window' : null
    });

    // Load the main UI
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (process.env.NODE_ENV === 'development') {
            mainWindow.webContents.openDevTools();
        }
        
        // Don't auto-start Python process - let user click Start Tracking button
        // startPythonProcessBackground(true);
    });

    // Handle window events
    mainWindow.on('closed', () => {
        isAppClosing = true;
        stopPythonProcess();
        stopPerformanceMonitoring();
        mainWindow = null;
    });

    // Handle window close attempt
    mainWindow.on('close', (event) => {
        if (pythonProcess && !isAppClosing) {
            const choice = dialog.showMessageBoxSync(mainWindow, {
                type: 'question',
                buttons: ['Yes', 'No'],
                title: 'Confirm Close',
                message: 'Eye tracking is still running. Are you sure you want to close?',
                defaultId: 1
            });
            
            if (choice === 1) {
                event.preventDefault();
                return;
            }
        }
        isAppClosing = true;
    });

    // Start performance monitoring
    startPerformanceMonitoring();
}

function findPythonExecutable() {
    const possiblePaths = [
        // First try the conda environment Python
        '/Users/premchand/miniforge3/envs/eye-tracker/bin/python',
        'python3',
        'python',
        '/usr/bin/python3',
        '/usr/bin/python',
        '/usr/local/bin/python3',
        '/usr/local/bin/python',
        process.platform === 'win32' ? 'py' : null
    ].filter(Boolean);

    for (const pythonPath of possiblePaths) {
        try {
            const { execSync } = require('child_process');
            execSync(`${pythonPath} --version`, { stdio: 'ignore' });
            return pythonPath;
        } catch (error) {
            continue;
        }
    }
    return null;
}

function getPythonScriptPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'eye_blink_counter.py');
    } else {
        return path.join(__dirname, '..', 'eye_blink_counter.py');
    }
}

function startPythonProcessBackground(streamVideo = false) {
    if (pythonProcess) {
        console.log('Python process already running');
        return Promise.resolve();
    }

    const pythonExecutable = findPythonExecutable();
    if (!pythonExecutable) {
        console.error('Python not found. Please install Python 3.x');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('python-error', 'Python not found. Please install Python 3.x');
        }
        return Promise.reject(new Error('Python not found'));
    }

    const scriptPath = getPythonScriptPath();
    if (!fs.existsSync(scriptPath)) {
        console.error(`Python script not found at: ${scriptPath}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('python-error', `Python script not found at: ${scriptPath}`);
        }
        return Promise.reject(new Error('Python script not found'));
    }

    // Build arguments array
    const args = [scriptPath];
    if (streamVideo) {
        args.push('--stream-video');
    }

    console.log(`Starting Python process in background: ${pythonExecutable} ${args.join(' ')}`);
    
    pythonProcess = spawn(pythonExecutable, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
    });

    pythonProcessPid = pythonProcess.pid;
    
    // Buffer to accumulate incomplete JSON messages
    let dataBuffer = '';

    // Handle Python process stdout
    pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        dataBuffer += output;
        
        // Process complete JSON messages
        let startIndex;
        while ((startIndex = dataBuffer.indexOf('JSON_START')) !== -1) {
            const endIndex = dataBuffer.indexOf('JSON_END', startIndex);
            if (endIndex === -1) {
                // Incomplete message, wait for more data
                break;
            }
            
            // Extract complete JSON message
            const jsonStr = dataBuffer.substring(startIndex + 10, endIndex); // 10 = length of 'JSON_START'
            
            try {
                const jsonData = JSON.parse(jsonStr);
                
                if (mainWindow && !mainWindow.isDestroyed()) {
                    // Forward all JSON data to the frontend
                    if (jsonData.status) {
                        console.log('Python status:', jsonData.status);
                        mainWindow.webContents.send('python-status', jsonData.status);
                    }
                    
                    // Forward blink count updates
                    if (typeof jsonData.blink_count === 'number') {
                        console.log('Sending blink count:', jsonData.blink_count);
                        mainWindow.webContents.send('blink-count', jsonData.blink_count);
                    }
                    
                    // Forward video frames
                    if (jsonData.video_frame) {
                        console.log('Sending video frame, length:', jsonData.video_frame.length);
                        mainWindow.webContents.send('video-frame', jsonData.video_frame);
                    }
                    
                    // Forward warnings
                    if (jsonData.warning) {
                        console.log('Python warning:', jsonData.warning);
                        mainWindow.webContents.send('python-info', jsonData.warning);
                    }
                    
                    // Forward any other data
                    mainWindow.webContents.send('python-data', jsonData);
                }
            } catch (e) {
                console.error('Error parsing JSON message:', e);
                console.error('Message was:', jsonStr.substring(0, 100) + '...');
            }
            
            // Remove processed message from buffer
            dataBuffer = dataBuffer.substring(endIndex + 8); // 8 = length of 'JSON_END'
        }
        
        // Handle any remaining non-delimited output (fallback for old format)
        if (dataBuffer.length > 0 && !dataBuffer.includes('JSON_START')) {
            const lines = dataBuffer.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                try {
                    // Try to parse as JSON (fallback)
                    const jsonData = JSON.parse(line.trim());
                    
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        if (jsonData.status) {
                            mainWindow.webContents.send('python-status', jsonData.status);
                        }
                        if (typeof jsonData.blink_count === 'number') {
                            mainWindow.webContents.send('blink-count', jsonData.blink_count);
                        }
                        if (jsonData.video_frame) {
                            mainWindow.webContents.send('video-frame', jsonData.video_frame);
                        }
                        if (jsonData.warning) {
                            mainWindow.webContents.send('python-info', jsonData.warning);
                        }
                        mainWindow.webContents.send('python-data', jsonData);
                    }
                } catch (e) {
                    // Not JSON, treat as regular output
                    console.log('Python non-JSON output length:', line.length);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('python-output', line);
                    }
                }
            }
            dataBuffer = ''; // Clear buffer after processing
        }
    });

    // Handle Python process errors
    pythonProcess.stderr.on('data', (data) => {
        const errorMessage = data.toString();
        
        // Filter out known non-critical warnings and info messages
        if (errorMessage.includes('landmark_projection_calculator.cc') ||
            errorMessage.includes('Using NORM_RECT without IMAGE_DIMENSIONS') ||
            errorMessage.includes('WARNING: All log messages before absl::InitializeLog()') ||
            errorMessage.includes('INFO: Created TensorFlow Lite XNNPACK delegate') ||
            errorMessage.includes('W0000') ||
            errorMessage.includes('I0000') ||
            errorMessage.includes('AVCaptureDeviceTypeExternal is deprecated')) {
            
            console.log('Python info/warning (filtered):', errorMessage.trim());
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('python-info', errorMessage.trim());
            }
        } else {
            console.error('Python stderr:', errorMessage);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('python-error', errorMessage);
            }
        }
    });

    // Handle Python process exit
    pythonProcess.on('close', (code, signal) => {
        console.log(`Python process exited with code ${code}`);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (code === 0) {
                mainWindow.webContents.send('python-status', 'Process stopped normally');
            } else if (!isAppClosing) {
                mainWindow.webContents.send('python-error', `Process exited unexpectedly (code: ${code})`);
                
                // Auto-restart if not closing and exit was unexpected
                setTimeout(() => {
                    if (!isAppClosing && !pythonProcess) {
                        console.log('Auto-restarting Python process...');
                        startPythonProcessBackground(streamVideo);
                    }
                }, 2000);
            }
        }
        
        pythonProcess = null;
        pythonProcessPid = null;
    });

    pythonProcess.on('error', (error) => {
        console.error('Python process error:', error);
        pythonProcess = null;
        pythonProcessPid = null;
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('python-error', error.message);
        }
    });

    return Promise.resolve();
}

// Legacy function for manual start (kept for compatibility)
function startPythonProcess(streamVideo = false) {
    return new Promise((resolve, reject) => {
        if (pythonProcess) {
            reject(new Error('Python process is already running'));
            return;
        }

        startPythonProcessBackground(streamVideo)
            .then(() => {
                // Wait a moment to ensure the process starts successfully
                setTimeout(() => {
                    if (pythonProcess && !pythonProcess.killed) {
                        resolve();
                    } else {
                        reject(new Error('Python process failed to start'));
                    }
                }, 1000);
            })
            .catch(reject);
    });
}

function stopPythonProcess() {
    if (pythonProcess) {
        console.log('Stopping Python process...');
        
        // Try graceful shutdown first
        if (process.platform === 'win32') {
            pythonProcess.kill('SIGTERM');
        } else {
            pythonProcess.kill('SIGINT');
        }

        // Force kill after timeout
        setTimeout(() => {
            if (pythonProcess && !pythonProcess.killed) {
                pythonProcess.kill('SIGKILL');
            }
        }, 3000);

        pythonProcess = null;
        pythonProcessPid = null;
    }
}

async function getSystemPerformance() {
    try {
        const [cpu, memory, processes] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            pythonProcessPid ? pidusage(pythonProcessPid).catch(() => null) : Promise.resolve(null)
        ]);

        // Calculate total CPU usage including Python process
        let totalCpuUsage = cpu.currentLoad || 0;
        let pythonCpuUsage = 0;
        let pythonMemoryUsage = 0;

        if (processes) {
            pythonCpuUsage = processes.cpu || 0;
            pythonMemoryUsage = (processes.memory || 0) / 1024 / 1024; // Convert to MB
        }

        // Energy impact calculation (simplified)
        let energyImpact = 0;
        if (process.platform === 'darwin') {
            // macOS energy impact estimation
            energyImpact = Math.round((totalCpuUsage / 100) * 50 + (memory.used / memory.total) * 30);
        } else {
            // Windows power usage estimation (watts)
            energyImpact = Math.round((totalCpuUsage / 100) * 15 + (memory.used / memory.total) * 5);
        }

        return {
            cpu: Math.round(totalCpuUsage * 10) / 10,
            memory: Math.round(memory.used / 1024 / 1024), // MB
            energyImpact,
            pythonCpu: Math.round(pythonCpuUsage * 10) / 10,
            pythonMemory: Math.round(pythonMemoryUsage),
            totalMemory: Math.round(memory.total / 1024 / 1024), // MB
            timestamp: Date.now(),
            platform: process.platform
        };
    } catch (error) {
        console.error('Error getting system performance:', error);
        return performanceData;
    }
}

function startPerformanceMonitoring() {
    performanceInterval = setInterval(async () => {
        const data = await getSystemPerformance();
        performanceData = data;
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('performance-data', data);
        }
    }, 1000); // Update every second
}

function stopPerformanceMonitoring() {
    if (performanceInterval) {
        clearInterval(performanceInterval);
        performanceInterval = null;
    }
}

// App event listeners
app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    stopPythonProcess();
    stopPerformanceMonitoring();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    stopPythonProcess();
    stopPerformanceMonitoring();
});

// IPC handlers
ipcMain.handle('start-tracking', async () => {
    try {
        if (pythonProcess) {
            return { success: true, message: 'Tracking already running' };
        }
        await startPythonProcessBackground(false);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('start-tracking-with-video', async () => {
    try {
        if (pythonProcess) {
            return { success: true, message: 'Video tracking already running' };
        }
        await startPythonProcessBackground(true);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('stop-tracking', async () => {
    try {
        if (!pythonProcess) {
            return { success: true, message: 'No tracking process running' };
        }
        stopPythonProcess();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-tracking-status', async () => {
    return {
        isRunning: !!pythonProcess,
        pid: pythonProcessPid,
        hasVideo: pythonProcess ? true : false // Assume video is enabled since we auto-start with video
    };
});



ipcMain.handle('get-performance', async () => {
    return performanceData;
});

ipcMain.handle('get-app-info', () => {
    return {
        name: app.getName(),
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged
    };
});

ipcMain.handle('open-camera-settings', async () => {
    try {
        const { shell } = require('electron');
        
        if (process.platform === 'darwin') {
            // macOS - Open System Preferences > Security & Privacy > Camera
            shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Camera');
        } else if (process.platform === 'win32') {
            // Windows - Open Camera settings
            shell.openExternal('ms-settings:privacy-webcam');
        } else {
            // Linux - Open system settings (varies by distribution)
            shell.openExternal('gnome-control-center privacy');
        }
        
        return { success: true };
    } catch (error) {
        console.error('Failed to open camera settings:', error);
        return { success: false, error: error.message };
    }
});

// Security
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
    });
}); 