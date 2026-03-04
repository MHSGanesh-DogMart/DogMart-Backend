const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyJWT } = require('../middleware/jwtAuth');

router.get('/:chatId', verifyJWT, async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: { chatId: req.params.chatId },
            orderBy: { createdAt: 'asc' },
        });
        res.json({ success: true, messages });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
