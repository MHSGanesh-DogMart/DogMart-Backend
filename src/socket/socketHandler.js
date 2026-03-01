const socketIO = require('socket.io');
const { admin } = require('../config/firebase');
const Message = require('../models/Message');
const Chat = require('../models/Chat');

let io;

const initSocket = (server) => {
    io = socketIO(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    // 1. Authentication Middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) throw new Error('Authentication error');
            // Verify Firebase JWT token
            const decodedToken = await admin.auth().verifyIdToken(token);
            socket.user = decodedToken; // Attach decoded user to the socket instance
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    // 2. Connection Events
    io.on('connection', (socket) => {
        console.log(`📡 Socket Connected: User ${socket.user.uid}`);

        // Join specific Chat Room
        socket.on('join_chat', (chatId) => {
            socket.join(chatId);
            console.log(`👥 User ${socket.user.uid} joined chat ${chatId}`);
        });

        // Typing Indicators
        socket.on('typing', ({ chatId }) => {
            socket.to(chatId).emit('typing', { userId: socket.user.uid });
        });

        socket.on('stop_typing', ({ chatId }) => {
            socket.to(chatId).emit('stop_typing', { userId: socket.user.uid });
        });

        // Send Message
        socket.on('send_message', async (data) => {
            try {
                const { chatId, messageText, receiverId } = data;

                // Save to MongoDB
                const newMessage = new Message({
                    chatId,
                    senderId: socket.user.uid,
                    senderName: data.senderName || 'User',
                    message: messageText
                });
                await newMessage.save();

                // Update MongoDB `Chat` document so UI Chat List updates without Firestore
                try {
                    // chatId format is usually "uidA_uidB", we split to get both participants securely
                    const participants = chatId.split('_');
                    await Chat.findOneAndUpdate(
                        { chatId },
                        {
                            $set: {
                                participants,
                                lastMessage: messageText,
                                lastMessageTime: new Date(),
                                lastSenderId: socket.user.uid,
                                isActive: true
                            },
                            $inc: { unreadCount: 1 }
                        },
                        { upsert: true, new: true }
                    );
                } catch (err) {
                    console.error('Failed to update MongoDB Chat doc:', err);
                }

                // Construct the payload
                const messagePayload = {
                    id: newMessage._id,
                    senderId: newMessage.senderId,
                    senderName: newMessage.senderName,
                    message: newMessage.message,
                    timestamp: newMessage.timestamp,
                    chatId: newMessage.chatId,
                    isRead: newMessage.isRead
                };

                // Broadcast to all users in the specific room EXCEPT the sender
                socket.to(chatId).emit('receive_message', messagePayload);

                // Send a global ping to the receiver so their Chat List badges update
                // We broadcast this to a personal room they join based on their UID if we had one,
                // But for now, since they might be on a different screen, emit to room so they get it globally
                socket.to(chatId).emit('chat_list_update', { chatId });

                // Also emit back to the sender so their UI updates with a server-acked timestamp
                socket.emit('message_sent_ack', messagePayload);
                socket.emit('chat_list_update', { chatId });

            } catch (error) {
                console.error('❌ Error handling sent message:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log(`📡 Socket Disconnected: User ${socket.user.uid}`);
        });
    });
};

const getIO = () => {
    if (!io) throw new Error("Socket.io not initialized!");
    return io;
}

module.exports = { initSocket, getIO };
