// src/socket/socketHandler.js — Prisma version
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

let io;

const initSocket = (server) => {
    io = socketIO(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) throw new Error('No token');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-replace-in-production');
            socket.user = { uid: decoded.uid || decoded.id, ...decoded };
            next();
        } catch (err) { next(new Error('Authentication error')); }
    });

    io.on('connection', (socket) => {
        console.log(`📡 Socket Connected: User ${socket.user.uid}`);
        socket.join(String(socket.user.uid));

        socket.on('join_chat', (chatId) => { socket.join(chatId); });
        socket.on('typing', ({ chatId }) => socket.to(chatId).emit('typing', { userId: socket.user.uid }));
        socket.on('stop_typing', ({ chatId }) => socket.to(chatId).emit('stop_typing', { userId: socket.user.uid }));

        socket.on('send_message', async (data) => {
            try {
                const { chatId, messageText } = data;

                // Save message to PostgreSQL via Prisma
                const newMessage = await prisma.message.create({
                    data: { chatId, senderId: socket.user.uid, senderName: data.senderName || 'User', message: messageText },
                });

                // Upsert chat record
                try {
                    const participants = chatId.split('_').map(Number);
                    await prisma.chat.upsert({
                        where: { chatId },
                        create: { chatId, participants, lastMessage: messageText, lastMessageTime: new Date(), lastSenderId: socket.user.uid, unreadCount: 1, isActive: true },
                        update: { lastMessage: messageText, lastMessageTime: new Date(), lastSenderId: socket.user.uid, unreadCount: { increment: 1 } },
                    });
                } catch (e) { console.error('Chat upsert failed:', e); }

                const payload = { id: newMessage.id, senderId: newMessage.senderId, senderName: newMessage.senderName, message: newMessage.message, timestamp: newMessage.createdAt, chatId, isRead: false };

                socket.to(chatId).emit('receive_message', payload);
                socket.to(chatId).emit('chat_list_update', { chatId });

                const receiverId = chatId.split('_').find(id => parseInt(id) !== socket.user.uid);
                if (receiverId) {
                    socket.to(receiverId).emit('receive_message', payload);
                    socket.to(receiverId).emit('chat_list_update', { chatId });
                    try {
                        const { sendToToken } = require('../config/notifications');
                        const receiver = await prisma.user.findUnique({ where: { uid: parseInt(receiverId) } });
                        if (receiver?.fcmToken) {
                            const body = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
                            await sendToToken(receiver.fcmToken, `New message from ${data.senderName || 'User'}`, body, { screen: '/chat', chatId });
                        }
                    } catch (_) { }
                }

                socket.emit('message_sent_ack', payload);
                socket.emit('chat_list_update', { chatId });
            } catch (error) { console.error('❌ send_message error:', error); }
        });

        socket.on('disconnect', () => console.log(`📡 Socket Disconnected: User ${socket.user.uid}`));
    });
};

const getIO = () => { if (!io) throw new Error('Socket.io not initialized!'); return io; };
module.exports = { initSocket, getIO };
