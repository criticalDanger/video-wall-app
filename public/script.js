// Initialize variables
let localStream;
let socket;
let peers = {};
let myId;
let videoEnabled = true;
let audioEnabled = true;

// DOM elements
const videoGrid = document.getElementById('videoGrid');
const localVideo = document.getElementById('localVideo');
const toggleVideoBtn = document.getElementById('toggleVideo');
const toggleAudioBtn = document.getElementById('toggleAudio');
const startButton = document.getElementById('startButton');
const permissionPrompt = document.getElementById('permissionPrompt');
const userCountElement = document.getElementById('userCount');

// Initialize the application
startButton.addEventListener('click', init);

async function init() {
    try {
        // Request camera and microphone permissions
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: true
        });
        
        // Display local video
        localVideo.srcObject = localStream;
        
        // Hide permission prompt
        permissionPrompt.classList.add('hidden');
        
        // Connect to Socket.io server
        connectToServer();
        
        // Setup control buttons
        setupControls();
        
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Camera access is required to use this application. Please grant permission and refresh the page.');
    }
}

function connectToServer() {
    socket = io();
    
    // Receive your own ID
    socket.on('me', (id) => {
        myId = id;
        console.log('My ID:', id);
    });
    
    // Receive list of existing users
    socket.on('allUsers', (users) => {
        console.log('Existing users:', users);
        users.forEach(userId => {
            createPeerConnection(userId, true);
        });
        updateUserCount();
    });
    
    // Handle new user joining
    socket.on('userJoined', (userId) => {
        console.log('User joined:', userId);
        createPeerConnection(userId, false);
        updateUserCount();
    });
    
    // Handle user leaving
    socket.on('userLeft', (userId) => {
        console.log('User left:', userId);
        if (peers[userId]) {
            peers[userId].destroy();
            delete peers[userId];
        }
        removeVideoElement(userId);
        updateUserCount();
    });
    
    // Handle WebRTC signaling
    socket.on('signal', (data) => {
        if (peers[data.from]) {
            peers[data.from].signal(data.signal);
        } else {
            // Create peer connection if it doesn't exist
            createPeerConnection(data.from, false, data.signal);
        }
    });
}

function createPeerConnection(userId, initiator, signal = null) {
    // Create new Simple Peer instance
    const peer = new SimplePeer({
        initiator: initiator,
        stream: localStream,
        trickle: false,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });
    
    // Handle signaling data
    peer.on('signal', (data) => {
        socket.emit('signal', {
            to: userId,
            signal: data
        });
    });
    
    // Handle incoming stream
    peer.on('stream', (stream) => {
        addVideoStream(userId, stream);
    });
    
    // Handle errors
    peer.on('error', (err) => {
        console.error('Peer error:', err);
        removeVideoElement(userId);
    });
    
    // Handle connection close
    peer.on('close', () => {
        removeVideoElement(userId);
    });
    
    // Store peer connection
    peers[userId] = peer;
    
    // If we have a signal, use it
    if (signal) {
        peer.signal(signal);
    }
}

function addVideoStream(userId, stream) {
    // Check if video element already exists
    let videoContainer = document.getElementById(`video-${userId}`);
    
    if (!videoContainer) {
        // Create new video container
        videoContainer = document.createElement('div');
        videoContainer.className = 'video-container loading';
        videoContainer.id = `video-${userId}`;
        
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        
        const label = document.createElement('div');
        label.className = 'video-label';
        label.textContent = `User ${userId.substring(0, 6)}`;
        
        videoContainer.appendChild(video);
        videoContainer.appendChild(label);
        videoGrid.appendChild(videoContainer);
        
        // Remove loading class when video loads
        video.onloadedmetadata = () => {
            videoContainer.classList.remove('loading');
        };
    }
    
    // Set the stream
    const video = videoContainer.querySelector('video');
    video.srcObject = stream;
}

function removeVideoElement(userId) {
    const videoContainer = document.getElementById(`video-${userId}`);
    if (videoContainer) {
        videoContainer.remove();
    }
}

function setupControls() {
    // Toggle video
    toggleVideoBtn.addEventListener('click', () => {
        videoEnabled = !videoEnabled;
        localStream.getVideoTracks()[0].enabled = videoEnabled;
        
        toggleVideoBtn.classList.toggle('active', !videoEnabled);
        toggleVideoBtn.querySelector('.btn-text').textContent = 
            videoEnabled ? 'Turn Off Video' : 'Turn On Video';
    });
    
    // Toggle audio
    toggleAudioBtn.addEventListener('click', () => {
        audioEnabled = !audioEnabled;
        localStream.getAudioTracks()[0].enabled = audioEnabled;
        
        toggleAudioBtn.classList.toggle('active', !audioEnabled);
        toggleAudioBtn.querySelector('.btn-text').textContent = 
            audioEnabled ? 'Turn Off Audio' : 'Turn On Audio';
    });
}

function updateUserCount() {
    const count = Object.keys(peers).length + 1; // +1 for yourself
    userCountElement.textContent = count;
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.disconnect();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});