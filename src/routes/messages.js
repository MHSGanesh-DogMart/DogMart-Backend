const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

/**
 * GET /api/messages/:chatId
 * Fetch chat history for a specific chat ID, sorted by timestamp ascending
 */
router.get('/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        const messages = await Message.find({ chatId }).sort({ timestamp: 1 });
        res.json({ success: true, messages });
    } catch (e) {
        console.error('Error fetching messages:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
