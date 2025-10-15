const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const path = require('path');

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Track connected users
const users = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);
    
    // Add user to the map
    users.set(socket.id, { id: socket.id });
    
    // Notify user of their own ID
    socket.emit('me', socket.id);
    
    // Send list of existing users to the new user
    const otherUsers = Array.from(users.keys()).filter(id => id !== socket.id);
    socket.emit('allUsers', otherUsers);
    
    // Notify existing users about the new user
    socket.broadcast.emit('userJoined', socket.id);
    
    // Handle WebRTC signaling
    socket.on('signal', (data) => {
        io.to(data.to).emit('signal', {
            from: socket.id,
            signal: data.signal
        });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        users.delete(socket.id);
        socket.broadcast.emit('userLeft', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});