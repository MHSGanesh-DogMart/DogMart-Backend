const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyAdmin } = require('../middleware/auth');
const { createAndSendNotification, sendMulticast } = require('../config/notifications');

// GET /api/admin/stats - Summary for Dashboard
router.get('/stats', verifyAdmin, async (req, res) => {
    try {
        const [userCount, pendingListings, activeListings, totalProducts, reportCount, subCount] = await Promise.all([
            prisma.user.count(),
            prisma.listing.count({ where: { status: 'active' } }), // Only active counts as pending for this context
            prisma.listing.count({ where: { status: 'active' } }),
            prisma.product.count({ where: { status: 'active' } }),
            prisma.sosAlert.count({ where: { status: 'active' } }),
            prisma.subscription.count({ where: { status: 'active' } })
        ]);

        // Revenue calculation from potentially completed service bookings or payments
        const revenueResult = await prisma.listing.aggregate({
            _sum: { price: true },
            where: { status: 'sold' }
        });

        res.json({
            users: userCount,
            listings: pendingListings,
            active: activeListings,
            products: totalProducts,
            reports: reportCount,
            subs: subCount,
            earnings: Math.round((revenueResult._sum.price || 0) * 0.15),
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/listings - List all listings with filters
router.get('/listings', verifyAdmin, async (req, res) => {
    try {
        const { status, type, limit = 50 } = req.query;
        const where = {};
        if (status) where.status = status;
        if (type) where.type = type;

        const listings = await prisma.listing.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Number(limit)
        });
        res.json({ listings });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PATCH /api/admin/listings/:id/status - Moderate listing
router.patch('/listings/:id/status', verifyAdmin, async (req, res) => {
    try {
        const { status, adminNote } = req.body;
        await prisma.listing.update({
            where: { id: parseInt(req.params.id) },
            data: { status, description: adminNote ? `${adminNote}` : undefined } // Adjusting schema use
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/admin/listings/:id - Delete a listing permanently
router.delete('/listings/:id', verifyAdmin, async (req, res) => {
    try {
        await prisma.listing.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ success: true, message: 'Listing deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// POST /api/admin/notify — Broadcast a notification to all users or a specific user
router.post('/notify', verifyAdmin, async (req, res) => {
    try {
        const { title, body, targetUserId, type = 'announcement' } = req.body;
        if (!title || !body) return res.status(400).json({ error: 'title and body are required' });

        if (targetUserId) {
            // Send to a specific user
            await createAndSendNotification(parseInt(targetUserId), title, body, { type }, type);
            return res.json({ success: true, sent: 1 });
        }

        // Broadcast to ALL users — save a DB row per user + FCM multicast
        const users = await prisma.user.findMany({ select: { uid: true, fcmToken: true } });

        // Save notification rows in parallel (bulk insert via Promise.all)
        await Promise.all(
            users.map(u =>
                prisma.notification.create({
                    data: { userId: u.uid, target: 'user', title, body, data: { type }, type }
                }).catch(() => { })
            )
        );

        // FCM multicast to all devices that have a token
        const tokens = users.map(u => u.fcmToken).filter(Boolean);
        if (tokens.length > 0) {
            await sendMulticast(tokens, title, body, { type });
        }

        res.json({ success: true, sent: users.length, fcmSent: tokens.length });
    } catch (e) {
        console.error('Admin broadcast error:', e);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/notify/history — See all sent announcements
router.get('/notify/history', verifyAdmin, async (req, res) => {
    try {
        const notifs = await prisma.notification.findMany({
            where: { type: 'announcement' },
            orderBy: { createdAt: 'desc' },
            take: 50,
            distinct: ['title', 'body']
        });
        res.json({ notifications: notifs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
