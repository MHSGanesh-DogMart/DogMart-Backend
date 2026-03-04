const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyJWT } = require('../middleware/jwtAuth');
const { getIO } = require('../socket/socketHandler');

router.get('/', verifyJWT, async (req, res) => {
    try {
        const userId = req.user.uid;
        const allChats = await prisma.chat.findMany({ orderBy: { lastMessageTime: 'desc' } });
        const chats = allChats.filter(c => (c.participants || []).map(String).includes(String(userId)));
        res.json({ chats });
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.post('/:chatId/read', verifyJWT, async (req, res) => {
    try {
        const chat = await prisma.chat.findUnique({ where: { chatId: req.params.chatId } });
        if (!chat) return res.json({ success: true });
        if (chat.lastSenderId !== req.user.uid && chat.unreadCount > 0) {
            await prisma.chat.update({ where: { chatId: req.params.chatId }, data: { unreadCount: 0 } });
            try { getIO().to(req.params.chatId).emit('chat_list_update', { chatId: req.params.chatId }); } catch (_) { }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
