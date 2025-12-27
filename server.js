/**
 * Simple Socket.IO server for Hijack! Chess multiplayer
 * Run with: node server.js
 * Requires: npm install express socket.io cors mongodb
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// MongoDB connection (replace with your connection string)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hijack-chess';
let db;
let analytics = {
    uniqueVisitors: 0,
    totalVisits: 0, // Cumulative unique visitors over all time
    peakConcurrent: 0,
    currentOnline: 0
};

// Track active sessions (socketId -> fingerprint mapping)
const activeSessions = new Map();

// Connect to MongoDB
MongoClient.connect(MONGODB_URI)
    .then(client => {
        console.log('Connected to MongoDB');
        db = client.db();
        loadAnalytics();
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        console.log('Running without analytics...');
    });

// Load analytics from database
async function loadAnalytics() {
    if (!db) return;
    try {
        // Create indexes for better performance
        await db.collection('visitors').createIndex({ fingerprint: 1 });
        await db.collection('sessions').createIndex({ lastSeen: 1 }, { expireAfterSeconds: 3600 }); // Auto-delete after 1 hour
        
        const stats = await db.collection('analytics').findOne({ _id: 'stats' });
        if (stats) {
            analytics.uniqueVisitors = stats.uniqueVisitors || 0;
            analytics.totalVisits = stats.totalVisits || 0;
            analytics.peakConcurrent = stats.peakConcurrent || 0;
        }
        
        // Calculate current online from active sessions (sessions updated in last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const activeSessions = await db.collection('sessions').countDocuments({
            lastSeen: { $gte: fiveMinutesAgo }
        });
        analytics.currentOnline = activeSessions;
        
        console.log('Analytics loaded:', analytics);
    } catch (err) {
        console.error('Error loading analytics:', err);
    }
}

// Save analytics to database
async function saveAnalytics() {
    if (!db) return;
    try {
        await db.collection('analytics').updateOne(
            { _id: 'stats' },
            { 
                $set: {
                    uniqueVisitors: analytics.uniqueVisitors,
                    totalVisits: analytics.totalVisits,
                    peakConcurrent: analytics.peakConcurrent,
                    lastUpdated: new Date()
                }
            },
            { upsert: true }
        );
    } catch (err) {
        console.error('Error saving analytics:', err);
    }
}

// Update session activity
async function updateSession(socketId, fingerprint) {
    if (!db) return;
    try {
        await db.collection('sessions').updateOne(
            { socketId },
            { 
                $set: {
                    fingerprint,
                    lastSeen: new Date()
                }
            },
            { upsert: true }
        );
    } catch (err) {
        console.error('Error updating session:', err);
    }
}

// Remove session from database
async function removeSession(socketId) {
    if (!db) return;
    try {
        await db.collection('sessions').deleteOne({ socketId });
    } catch (err) {
        console.error('Error removing session:', err);
    }
}

// Check if visitor is unique
async function isUniqueVisitor(fingerprint) {
    if (!db) return false;
    try {
        const visitor = await db.collection('visitors').findOne({ fingerprint });
        return !visitor;
    } catch (err) {
        console.error('Error checking visitor:', err);
        return false;
    }
}

// Record visitor
async function recordVisitor(fingerprint, socketId) {
    if (!db) return;
    try {
        await db.collection('visitors').updateOne(
            { fingerprint },
            { 
                $set: {
                    lastVisit: new Date(),
                    socketId
                },
                $inc: { visitCount: 1 }
            },
            { upsert: true }
        );
    } catch (err) {
        console.error('Error recording visitor:', err);
    }
}

// Store active rooms
const rooms = new Map();

// Matchmaking queue: players waiting for random opponents
// Structure: [{ socketId, timeControl: 'none' | '60+0' | etc., ignoreTime: boolean }]
const matchmakingQueue = [];

app.use(cors());

// Serve static files (optional - for serving the HTML file)
app.use(express.static('.'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Analytics endpoint
app.get('/api/analytics', (req, res) => {
    res.json(analytics);
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Request fingerprint from client
    socket.emit('requestFingerprint');
    
    socket.on('fingerprint', async (fingerprint) => {
        // Store session mapping
        activeSessions.set(socket.id, fingerprint);
        
        // Check if this is a first-time visitor
        const isUnique = await isUniqueVisitor(fingerprint);
        
        if (isUnique) {
            // New unique visitor - increment both counters
            analytics.uniqueVisitors++;
            analytics.totalVisits++; // totalVisits = cumulative unique visitors
            await saveAnalytics();
        }
        
        // Update current online count
        analytics.currentOnline++;
        
        // Update peak if needed
        if (analytics.currentOnline > analytics.peakConcurrent) {
            analytics.peakConcurrent = analytics.currentOnline;
            await saveAnalytics();
        }
        
        // Record visitor and update session
        await recordVisitor(fingerprint, socket.id);
        await updateSession(socket.id, fingerprint);
        
        // Broadcast updated stats to all clients
        io.emit('analyticsUpdate', analytics);
    });

    socket.on('createRoom', (data) => {
        const { roomId } = data;
        
        if (rooms.has(roomId)) {
            socket.emit('error', { message: 'Room already exists' });
            return;
        }

        // Create new room
        rooms.set(roomId, {
            players: [socket.id],
            white: socket.id,
            black: null,
            timeControl: null
        });

        socket.join(roomId);
        socket.emit('roomCreated', { roomId });
        console.log(`Room ${roomId} created by ${socket.id}`);
    });

    socket.on('joinRoom', (data) => {
        const { roomId } = data;
        
        if (!rooms.has(roomId)) {
            socket.emit('error', { message: 'Room does not exist' });
            return;
        }

        const room = rooms.get(roomId);
        
        if (room.players.length >= 2) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        // Add player to room
        room.players.push(socket.id);
        room.black = socket.id;
        socket.join(roomId);
        
        socket.emit('roomJoined', { roomId });
        
        // Send time control to the joiner
        if (room.timeControl) {
            socket.emit('timeControlSync', { timeControl: room.timeControl });
        }
        
        // Notify the room creator that opponent joined
        socket.to(roomId).emit('opponentJoined');
        
        console.log(`${socket.id} joined room ${roomId}`);
    });

    socket.on('move', (data) => {
        const { roomId, from, to, moveType, whiteTime, blackTime, timestamp } = data;
        
        // Broadcast move, clock times, and timestamp to other player
        socket.to(roomId).emit('opponentMove', { 
            from, 
            to, 
            moveType,
            whiteTime,
            blackTime,
            timestamp
        });
        console.log(`Move in room ${roomId}: ${JSON.stringify(from)} to ${JSON.stringify(to)}`);
    });

    socket.on('gameOver', (data) => {
        const { roomId, reason } = data;
        
        // Broadcast game over to other player in the room
        socket.to(roomId).emit('gameOver', { reason });
        console.log(`Game over in room ${roomId}: ${reason}`);
    });

    socket.on('timeControlSet', (data) => {
        const { roomId, timeControl } = data;
        // Store time control for the room
        if (rooms.has(roomId)) {
            rooms.get(roomId).timeControl = timeControl;
        }
    });

    socket.on('rematchRequest', (data) => {
        const { roomId } = data;
        socket.to(roomId).emit('rematchRequest');
        console.log(`Rematch requested in room ${roomId}`);
    });

    socket.on('rematchAccept', (data) => {
        const { roomId } = data;
        socket.to(roomId).emit('rematchAccepted');
        console.log(`Rematch accepted in room ${roomId}`);
    });

    socket.on('rematchDecline', (data) => {
        const { roomId } = data;
        socket.to(roomId).emit('rematchDeclined');
        console.log(`Rematch declined in room ${roomId}`);
    });

    socket.on('findMatch', (data) => {
        const { timeControl, ignoreTime } = data;
        console.log(`${socket.id} looking for random opponent... (Time: ${timeControl}, Ignore: ${ignoreTime})`);
        
        // Find a compatible opponent in the queue
        let matchedIndex = -1;
        
        for (let i = 0; i < matchmakingQueue.length; i++) {
            const waiting = matchmakingQueue[i];
            
            // Match conditions:
            // 1. Both have same time control
            // 2. One or both have ignoreTime enabled
            const sameTime = waiting.timeControl === timeControl;
            const eitherIgnores = waiting.ignoreTime || ignoreTime;
            
            if (sameTime || eitherIgnores) {
                matchedIndex = i;
                break;
            }
        }
        
        if (matchedIndex !== -1) {
            // Found a match!
            const opponent = matchmakingQueue[matchedIndex];
            matchmakingQueue.splice(matchedIndex, 1); // Remove from queue
            
            // Decide which time control to use:
            // If both have same time -> use it
            // If different, prioritize the one who didn't ignore (if only one ignored)
            // If both ignored, use the first player's time
            let finalTimeControl;
            if (opponent.timeControl === timeControl) {
                finalTimeControl = timeControl;
            } else if (!opponent.ignoreTime && ignoreTime) {
                // Opponent didn't ignore, use their time
                finalTimeControl = opponent.timeControl;
            } else if (opponent.ignoreTime && !ignoreTime) {
                // Current player didn't ignore, use their time
                finalTimeControl = timeControl;
            } else {
                // Both ignored, use opponent's time (they were waiting first)
                finalTimeControl = opponent.timeControl;
            }
            
            // Generate a unique room ID
            const roomId = crypto.randomBytes(3).toString('hex').toUpperCase();
            
            // Create room with both players
            rooms.set(roomId, {
                players: [opponent.socketId, socket.id],
                white: opponent.socketId,
                black: socket.id,
                timeControl: finalTimeControl
            });
            
            // Add both to the room
            io.sockets.sockets.get(opponent.socketId)?.join(roomId);
            socket.join(roomId);
            
            // Notify both players
            io.to(opponent.socketId).emit('matchFound', { roomId, color: 'white', timeControl: finalTimeControl });
            socket.emit('matchFound', { roomId, color: 'black', timeControl: finalTimeControl });
            
            console.log(`Match created: ${roomId} - ${opponent.socketId} (white) vs ${socket.id} (black) - Time: ${finalTimeControl}`);
        } else {
            // No compatible opponent, add to queue
            matchmakingQueue.push({ socketId: socket.id, timeControl, ignoreTime });
            socket.emit('searching');
            console.log(`${socket.id} added to matchmaking queue (waiting for ${ignoreTime ? 'any' : timeControl})`);
        }
    });

    socket.on('cancelMatchmaking', () => {
        // Remove player from queue
        const index = matchmakingQueue.findIndex(p => p.socketId === socket.id);
        if (index > -1) {
            matchmakingQueue.splice(index, 1);
            console.log(`${socket.id} cancelled matchmaking`);
        }
    });

    socket.on('leaveRoom', (data) => {
        const { roomId } = data;
        
        if (rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.players = room.players.filter(id => id !== socket.id);
            
            if (room.players.length === 0) {
                // Delete empty room
                rooms.delete(roomId);
                console.log(`Room ${roomId} deleted`);
            } else {
                // Notify remaining player
                socket.to(roomId).emit('opponentDisconnected');
            }
        }
        
        socket.leave(roomId);
    });

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
        
        // Remove from matchmaking queue if present
        const queueIndex = matchmakingQueue.findIndex(p => p.socketId === socket.id);
        if (queueIndex > -1) {
            matchmakingQueue.splice(queueIndex, 1);
            console.log(`${socket.id} removed from matchmaking queue on disconnect`);
        }
        
        // Remove session from active sessions
        activeSessions.delete(socket.id);
        await removeSession(socket.id);
        
        // Decrement online counter
        analytics.currentOnline = Math.max(0, analytics.currentOnline - 1);
        
        // Broadcast updated stats
        io.emit('analyticsUpdate', analytics);
        
        // Clean up rooms
        rooms.forEach((room, roomId) => {
            if (room.players.includes(socket.id)) {
                room.players = room.players.filter(id => id !== socket.id);
                
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                    console.log(`Room ${roomId} deleted after disconnect`);
                } else {
                    // Notify remaining player
                    io.to(roomId).emit('opponentDisconnected');
                }
            }
        });
    });
});

server.listen(PORT, () => {
    console.log(`Hijack! Chess server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
