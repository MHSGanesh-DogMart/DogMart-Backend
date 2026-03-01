const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const admin = require('firebase-admin');

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

// GET /api/chats
// Fetch all active chats where the current user is a participant
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const chats = await Chat.find({ participants: userId })
            .sort({ lastMessageTime: -1 });

        res.json({ chats });
    } catch (err) {
        console.error('Error fetching chats:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/chats/:chatId/read
// Clear the unread count for a specific chat for the current user
router.post('/:chatId/read', verifyToken, async (req, res) => {
    try {
        const { chatId } = req.params;

        // Find the chat
        const chat = await Chat.findOne({ chatId });
        if (!chat) {
            // Since this is a newly migrated feature, old chats might not exist in the Chat model yet.
            // If it doesn't exist, unreadCount is inherently 0, so we just return success.
            return res.json({ success: true, message: 'Chat not found but considered read' });
        }

        // Only clear unread count if the current user is NOT the last sender
        // (meaning they are the one reading the other person's message)
        if (chat.lastSenderId !== req.user.uid && chat.unreadCount > 0) {
            chat.unreadCount = 0;
            await chat.save();
        }

        res.json({ success: true, chat });
    } catch (err) {
        console.error('Error marking chat as read:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
