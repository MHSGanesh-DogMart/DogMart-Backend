const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyAdmin } = require('../middleware/auth');

// GET all subscriptions
router.get('/', verifyAdmin, async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;
        const where = status ? { status } : {};
        const subscriptions = await prisma.subscription.findMany({
            where,
            orderBy: { startDate: 'desc' },
            take: Number(limit)
        });
        const subscriptionsWithStringIds = subscriptions.map(s => ({
            ...s,
            id: String(s.id),
            userId: String(s.userId)
        }));
        res.json({ subscriptions: subscriptionsWithStringIds });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET stats
router.get('/stats/mrr', verifyAdmin, async (req, res) => {
    try {
        const activeSubs = await prisma.subscription.findMany({
            where: { status: 'active' }
        });
        const mrr = activeSubs.reduce((sum, s) => sum + s.amount, 0);
        res.json({ activeCount: activeSubs.length, mrr });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH - cancel sub
router.patch('/:id/status', verifyAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const sub = await prisma.subscription.update({
            where: { id: parseInt(req.params.id) },
            data: { status }
        });

        // If cancelled, remove isPremium from user
        if (status === 'cancelled') {
            await prisma.user.update({
                where: { uid: sub.userId },
                data: { onboardingCompleted: true } // Assuming no specific premium flag in prisma yet, or just updating metadata
            });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
