// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Redis = require('ioredis');


const app = express();
const server = http.createServer(app);
const io = new Server(server);
const redisPub = new Redis(); // Publisher
const redisSub = new Redis(); // Subscriber


// Servir les fichiers statiques
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Liste des salons
let rooms = new Set();


redisSub.subscribe('chat_messages', (err) => {
    if (err) console.error('Erreur subscription Redis:', err);
});

redisSub.on('message', (channel, message) => {
    if (channel === 'chat_messages') {
        const data = JSON.parse(message);
        io.to(data.room).emit('chat message', data);
    }
});

redisSub.subscribe('chat_rooms');

redisSub.on('message', (channel, message) => {
    if (channel === 'chat_rooms') {
        const updatedRooms = JSON.parse(message);
        io.emit('update rooms', updatedRooms);
    }
});

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
            redisPub.publish('chat_rooms', JSON.stringify(Array.from(rooms)));
            console.log(' Salon créé:', room);
        }

        socket.join(room);
        socket.data.username = username;
        socket.data.room = room;

        redisPub.publish('chat_messages', JSON.stringify({
            username,
            room,
            message: `${username} a créé et rejoint le salon ${room}. Attention la peinture et toutes fraiche`
        }));
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

        redisPub.publish('chat_messages', JSON.stringify({
            username,
            room,
            message: `${username} a rejoint le salon ${room}.`
        }));
        cb && cb({ ok: true });
    });

    // Messages de chat
    socket.on('chat message', (data) => {
        const { username, room, message } = data || {};
        if (!username || !room || !message) return;
        redisPub.publish('chat_messages', JSON.stringify(data));
        console.log(`[${room}] ${username}: ${message}`);
    });

    // Déconnexion
    socket.on('disconnect', () => {
        const { username, room } = socket.data || {};
        if (username && room) {
            redisPub.publish('chat_messages', JSON.stringify({
                username,
                room,
                message: `${username} a quitté ${room}. Tu vas tous nous manquer... Un peu. :/`
            }));

            // Supprimer le salon si vide
            const size = io.sockets.adapter.rooms.get(room);
            if (!size) {
                rooms.delete(room);
                io.emit('update rooms', Array.from(rooms));
                console.log('Salon supprimé:', room);
            }
        }
        console.log('🔴 Utilisateur déconnecté:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(` Serveur en écoute sur http://localhost:${PORT}`));
