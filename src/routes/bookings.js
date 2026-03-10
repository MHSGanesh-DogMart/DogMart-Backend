const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { createAndSendTopic, createAndSendNotification } = require('../config/notifications');

// Removed getUserToken as createAndSendNotification handles it internally

// GET all bookings
router.get('/', async (req, res) => {
    try {
        const { status, limit = 100 } = req.query;
        const where = status ? { status } : {};
        const bookings = await prisma.booking.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Number(limit)
        });
        const bookingsWithStringIds = bookings.map(b => ({
            ...b,
            id: String(b.id),
            userId: String(b.userId),
            listingId: b.listingId ? String(b.listingId) : null
        }));
        res.json({ bookings: bookingsWithStringIds, total: bookings.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single booking
router.get('/:id', async (req, res) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { id: parseInt(req.params.id) }
        });
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        const bookingWithStringIds = {
            ...booking,
            id: String(booking.id),
            userId: String(booking.userId),
            listingId: booking.listingId ? String(booking.listingId) : null
        };
        res.json(bookingWithStringIds);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create booking
router.post('/', async (req, res) => {
    try {
        const { userId, providerId, listingId, sessionType, amountPaid, date, time } = req.body;
        const booking = await prisma.booking.create({
            data: {
                userId: parseInt(userId),
                providerId: providerId ? parseInt(providerId) : null,
                listingId: listingId ? parseInt(listingId) : null,
                sessionType,
                amountPaid: parseFloat(amountPaid || 0),
                status: 'pending',
                date: date || null,
                timeSlot: time || null
            }
        });

        // 🔔 Notify admin
        await createAndSendTopic(
            'admin',
            '🆕 New Booking Received',
            `${sessionType || 'Session'} booking — ₹${amountPaid || 0}`,
            { bookingId: booking.id.toString(), type: 'new_booking' },
            'new_booking'
        );

        // 🔔 Notify provider if applicable
        if (providerId) {
            await createAndSendNotification(
                providerId,
                'New Booking Request! 📆',
                `You have a new request for ${sessionType || 'a service'}.`,
                { bookingId: booking.id.toString(), type: 'new_booking' },
                'new_booking'
            );
        }

        res.json({ id: booking.id, success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status, reason } = req.body;
        const bookingId = parseInt(req.params.id);

        const booking = await prisma.booking.update({
            where: { id: bookingId },
            data: { status, adminNote: reason }
        });

        // 🔔 Notify user
        let title = '', body = '', type = '';
        if (status === 'confirmed') {
            title = '✅ Booking Accepted!';
            body = `Your ${booking.sessionType || 'session'} has been accepted.`;
            type = 'booking_confirmed';
        } else if (status === 'cancelled') {
            title = '❌ Booking Rejected!';
            body = reason || 'Your booking has been rejected.';
            type = 'booking_rejected';
        }

        if (title) {
            await createAndSendNotification(
                booking.userId,
                title,
                body,
                { bookingId: bookingId.toString(), type },
                type
            );
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET stats
router.get('/stats/summary', async (req, res) => {
    try {
        const stats = await prisma.booking.groupBy({
            by: ['status'],
            _count: { id: true },
            _sum: { amountPaid: true }
        });

        const total = await prisma.booking.count();
        const summary = {
            total,
            active: stats.find(s => s.status === 'active')?._count.id || 0,
            completed: stats.find(s => s.status === 'completed')?._count.id || 0,
            cancelled: stats.find(s => s.status === 'cancelled')?._count.id || 0,
            totalEarnings: stats.find(s => s.status === 'completed')?._sum.amountPaid || 0
        };
        res.json(summary);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

module.exports = router;
