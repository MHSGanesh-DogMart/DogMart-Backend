const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyAdmin } = require('../middleware/auth');

// GET /api/admin/stats - Summary for Dashboard
router.get('/stats', verifyAdmin, async (req, res) => {
    try {
        const [userCount, pendingListings, activeListings, reportCount] = await Promise.all([
            prisma.user.count(),
            prisma.listing.count({ where: { status: 'pending' } }),
            prisma.listing.count({ where: { status: 'active' } }),
            prisma.sosAlert.count({ where: { status: 'active' } })
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
            reports: reportCount,
            earnings: Math.round((revenueResult._sum.price || 0) * 0.15),
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/listings - List all listings with filters
router.get('/listings', verifyAdmin, async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;
        const where = status ? { status } : {};

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

module.exports = router;
