// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir les fichiers statiques
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 🔹 Liste des salons
let rooms = new Set();

io.on('connection', (socket) => {
    console.log('🟢 Utilisateur connecté:', socket.id);

    // Envoyer la liste actuelle des salons au client
    socket.emit('update rooms', Array.from(rooms));

    // Création d’un salon
    socket.on('create room', (data, cb) => {
        const { username, room } = data || {};
        if (!username || !room) return cb && cb({ ok: false, error: 'missing-fields' });

        if (!rooms.has(room)) {
            rooms.add(room);
            io.emit('update rooms', Array.from(rooms)); // Notifier tout le monde
            console.log('🆕 Salon créé:', room);
        }

        socket.join(room);
        socket.data.username = username;
        socket.data.room = room;

        io.to(room).emit('room message', { message: `🎉 ${username} a créé et rejoint le salon ${room}.` });
        cb && cb({ ok: true });
    });

    // Rejoindre un salon existant
    socket.on('join room', (data, cb) => {
        const { username, room } = data || {};
        if (!username || !room) return cb && cb({ ok: false, error: 'missing-fields' });
        if (!rooms.has(room)) return cb && cb({ ok: false, error: 'room-not-exist' });

        socket.join(room);
        socket.data.username = username;
        socket.data.room = room;

        io.to(room).emit('room message', { message: `👋 ${username} a rejoint le salon ${room}.` });
        cb && cb({ ok: true });
    });

    // Messages de chat
    socket.on('chat message', (data) => {
        const { username, room, message } = data || {};
        if (!username || !room || !message) return;
        io.to(room).emit('chat message', { username, room, message });
        console.log(`[${room}] ${username}: ${message}`);
    });

    // Déconnexion
    socket.on('disconnect', () => {
        const { username, room } = socket.data || {};
        if (username && room) {
            socket.to(room).emit('room message', { message: `❌ ${username} a quitté ${room}.` });

            // Supprimer le salon si vide
            const s = io.sockets.adapter.rooms.get(room);
            const size = s ? s.size : 0;
            if (size === 0 && rooms.has(room)) {
                rooms.delete(room);
                io.emit('update rooms', Array.from(rooms));
                console.log('❌ Salon supprimé:', room);
            }
        }
        console.log('🔴 Utilisateur déconnecté:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Serveur en écoute sur http://localhost:${PORT}`));
