// Global state
let ws, audioContext, processor, source, stream;
let isRecording = false;
let timerInterval;
let startTime;
let audioBuffer = new Int16Array(0);
let wsConnected = false;
let streamInitialized = false;
let isAutoStarted = false;
let mediaRecorder;
let recordedChunks = [];

// DOM elements
const recordButton = document.getElementById('recordButton');
const transcript = document.getElementById('transcript');
const enhancedTranscript = document.getElementById('enhancedTranscript');
const copyButton = document.getElementById('copyButton');
const copyEnhancedButton = document.getElementById('copyEnhancedButton');
const readabilityButton = document.getElementById('readabilityButton');
const askAIButton = document.getElementById('askAIButton');
const correctnessButton = document.getElementById('correctnessButton');

// Configuration
const targetSeconds = 5;
const urlParams = new URLSearchParams(window.location.search);
const autoStart = urlParams.get('start') === '1';

// Utility functions
const isMobileDevice = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

async function copyToClipboard(text, button) {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        showCopiedFeedback(button, 'Copied!');
    } catch (err) {
        console.error('Clipboard copy failed:', err);
    }
}

function showCopiedFeedback(button, message) {
    if (!button) return;
    const originalText = button.textContent;
    button.textContent = message;
    setTimeout(() => {
        button.textContent = originalText;
    }, 2000);
}

// Timer functions
function startTimer() {
    clearInterval(timerInterval);
    document.getElementById('timer').textContent = '00:00';
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        document.getElementById('timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// WebSocket handling
function updateConnectionStatus(status) {
    const statusDot = document.getElementById('connectionStatus');
    statusDot.classList.remove('connected', 'connecting', 'idle');
    
    switch (status) {
        case 'connected':  // Connected and ready
            statusDot.classList.add('connected');
            statusDot.style.backgroundColor = '#34C759';  // Green
            break;
        case 'recording':  // Currently recording
            statusDot.classList.add('connecting');
            statusDot.style.backgroundColor = '#FF9500';  // Orange
            break;
        case 'processing':  // Processing transcription
            statusDot.classList.add('connecting');
            statusDot.style.backgroundColor = '#007AFF';  // Blue
            break;
        case 'idle':  // Connected but idle
            statusDot.classList.add('idle');
            statusDot.style.backgroundColor = '#34C759';  // Green
            break;
        default:  // Disconnected
            statusDot.style.backgroundColor = '#FF3B30';  // Red
    }
}

function initializeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${window.location.host}/api/v1/ws`);
    
    ws.onopen = () => {
        wsConnected = true;
        updateConnectionStatus('connected');
        if (autoStart && !isRecording && !isAutoStarted) startRecording();
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'status':
                updateConnectionStatus(data.status);
                break;
            case 'pong':
                // 心跳响应
                break;
        }
    };
    
    ws.onclose = () => {
        wsConnected = false;
        updateConnectionStatus('disconnected');
        setTimeout(initializeWebSocket, 1000);
    };
}

// Audio recording functions
async function initMediaRecorder() {
    try {
        if (!streamInitialized) {
            stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            streamInitialized = true;
        }

        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            console.log('Recording stopped, processing audio...');
            updateConnectionStatus('processing');
            
            // 创建音频Blob并上传转录
            const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
            await uploadAndTranscribe(audioBlob);
        };

        return true;
    } catch (error) {
        console.error('Error initializing media recorder:', error);
        alert('Failed to access microphone: ' + error.message);
        return false;
    }
}

async function uploadAndTranscribe(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        console.log('Uploading audio for transcription...');
        
        const response = await fetch('/api/v1/transcribe', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Transcription failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // 显示转录结果
        transcript.value = result.transcription;
        transcript.scrollTop = transcript.scrollHeight;
        
        // 自动复制到剪贴板
        await copyToClipboard(result.transcription, copyButton);
        
        updateConnectionStatus('idle');
        console.log('Transcription completed:', result.transcription);
        
    } catch (error) {
        console.error('Transcription error:', error);
        transcript.value = 'Transcription failed: ' + error.message;
        updateConnectionStatus('idle');
    }
}

// Recording control
async function startRecording() {
    if (isRecording) return;
    
    try {
        transcript.value = '';
        enhancedTranscript.value = '';

        if (!await initMediaRecorder()) {
            return;
        }

        isRecording = true;
        isAutoStarted = true;
        
        // 发送录音状态更新
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
                type: 'recording_status', 
                recording: true 
            }));
        }
        
        // 开始录音
        mediaRecorder.start();
        
        startTimer();
        recordButton.textContent = 'Stop';
        recordButton.classList.add('recording');
        updateConnectionStatus('recording');
        
        console.log('Recording started...');
        
    } catch (error) {
        console.error('Error starting recording:', error);
        alert('Failed to start recording: ' + error.message);
        isRecording = false;
        recordButton.textContent = 'Start';
        recordButton.classList.remove('recording');
        updateConnectionStatus('idle');
    }
}

async function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    isRecording = false;
    
    // 发送录音状态更新
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
            type: 'recording_status', 
            recording: false 
        }));
    }
    
    // 停止录音
    mediaRecorder.stop();
    
    stopTimer();
    recordButton.textContent = 'Start';
    recordButton.classList.remove('recording');
    
    console.log('Recording stopped, processing...');
}

// Button event handlers
recordButton.addEventListener('click', () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

copyButton.addEventListener('click', () => {
    copyToClipboard(transcript.value, copyButton);
});

copyEnhancedButton.addEventListener('click', () => {
    copyToClipboard(enhancedTranscript.value, copyEnhancedButton);
});

readabilityButton.addEventListener('click', async () => {
    if (!transcript.value.trim()) return;
    
    try {
        readabilityButton.disabled = true;
        readabilityButton.textContent = 'Processing...';
        enhancedTranscript.value = '';
        
        const response = await fetch('/api/v1/readability', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: transcript.value
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const reader = response.body.getReader();
        let result = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            result += chunk;
            enhancedTranscript.value = result;
            enhancedTranscript.scrollTop = enhancedTranscript.scrollHeight;
        }
        
    } catch (error) {
        console.error('Readability error:', error);
        enhancedTranscript.value = 'Error processing readability: ' + error.message;
    } finally {
        readabilityButton.disabled = false;
        readabilityButton.textContent = 'Readability';
    }
});

askAIButton.addEventListener('click', async () => {
    if (!transcript.value.trim()) return;
    
    try {
        askAIButton.disabled = true;
        askAIButton.textContent = 'Processing...';
        
        const response = await fetch('/api/v1/ask_ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: transcript.value
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        enhancedTranscript.value = result.answer;
        enhancedTranscript.scrollTop = enhancedTranscript.scrollHeight;
        
    } catch (error) {
        console.error('Ask AI error:', error);
        enhancedTranscript.value = 'Error processing AI question: ' + error.message;
    } finally {
        askAIButton.disabled = false;
        askAIButton.textContent = 'Ask AI';
    }
});

correctnessButton.addEventListener('click', async () => {
    if (!transcript.value.trim()) return;
    
    try {
        correctnessButton.disabled = true;
        correctnessButton.textContent = 'Processing...';
        enhancedTranscript.value = '';
        
        const response = await fetch('/api/v1/correctness', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: transcript.value
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const reader = response.body.getReader();
        let result = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            result += chunk;
            enhancedTranscript.value = result;
            enhancedTranscript.scrollTop = enhancedTranscript.scrollHeight;
        }
        
    } catch (error) {
        console.error('Correctness error:', error);
        enhancedTranscript.value = 'Error processing correctness check: ' + error.message;
    } finally {
        correctnessButton.disabled = false;
        correctnessButton.textContent = 'Correctness';
    }
});

// Theme toggle functionality
const themeToggle = document.getElementById('themeToggle');
const currentTheme = localStorage.getItem('theme') || 'light';

document.documentElement.setAttribute('data-theme', currentTheme);
themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
});

// Initialize
initializeWebSocket();

// Heartbeat to keep connection alive
setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
    }
}, 30000);