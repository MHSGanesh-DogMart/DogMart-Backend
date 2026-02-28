const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { sendToTopic, sendToToken } = require('../config/notifications');

// ── Helper — get user FCM token from Firestore ──────────────────────────────
async function getUserToken(userId) {
    if (!userId) return null;
    try {
        const doc = await db.collection('users').doc(userId).get();
        return doc.exists ? doc.data()?.fcmToken || null : null;
    } catch { return null; }
}

// GET all bookings with optional filters
router.get('/', async (req, res) => {
    try {
        const { status, date, limit = 100 } = req.query;
        let query = db.collection('bookings').orderBy('createdAt', 'desc').limit(Number(limit));
        if (status) query = query.where('status', '==', status);
        const snap = await query.get();
        const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ bookings, total: bookings.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single booking
router.get('/:id', async (req, res) => {
    try {
        const doc = await db.collection('bookings').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Booking not found' });
        res.json({ id: doc.id, ...doc.data() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create booking (triggered by Flutter app via backend — optional direct route)
router.post('/', async (req, res) => {
    try {
        const data = {
            ...req.body,
            status: 'pending',
            createdAt: new Date(),
        };
        const ref = await db.collection('bookings').add(data);

        // 🔔 Notify admin panel (web push to 'admin' topic)
        await sendToTopic(
            'admin',
            '🆕 New Booking Received',
            `${data.sessionType || 'Session'} booking from ${data.userName || 'a user'} — ₹${data.amountPaid || 0}`,
            { bookingId: ref.id, type: 'new_booking' }
        );

        res.json({ id: ref.id, success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH booking status — admin confirms/cancels
router.patch('/:id/status', async (req, res) => {
    try {
        const { status, reason } = req.body;
        const bookingRef = db.collection('bookings').doc(req.params.id);

        // Fetch booking to get userId and session info
        const snap = await bookingRef.get();
        if (!snap.exists) return res.status(404).json({ error: 'Booking not found' });
        const booking = snap.data();

        const updateData = {
            status,
            adminNote: reason || null,
            updatedAt: new Date(),
        };

        if (status === 'confirmed') {
            updateData.confirmedAt = new Date();
        }

        await bookingRef.update(updateData);

        // 🔔 Notify the user based on status change
        if (booking?.userId) {
            const token = await getUserToken(booking.userId);

            if (status === 'confirmed' && token) {
                await sendToToken(
                    token,
                    '✅ Booking Accepted!',
                    `Your ${booking.sessionType || 'session'} on ${booking.date || ''} has been accepted. See you there!`,
                    { bookingId: req.params.id, type: 'booking_confirmed', screen: '/my-bookings' }
                );
            } else if (status === 'cancelled' && token) {
                await sendToToken(
                    token,
                    '❌ Booking Rejected!',
                    reason
                        ? `Booking rejected: ${reason}`
                        : `Your ${booking.sessionType || 'session'} booking has been rejected.`,
                    { bookingId: req.params.id, type: 'booking_cancelled', screen: '/my-bookings' }
                );
            } else if (status === 'active' && token) {
                await sendToToken(
                    token,
                    '🟢 Session Started!',
                    `Your ${booking.sessionType || 'session'} is now active. Have a great time!`,
                    { bookingId: req.params.id, type: 'session_started', screen: '/active-session' }
                );
            }
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET bookings stats (dashboard)
router.get('/stats/summary', async (req, res) => {
    try {
        const allSnap = await db.collection('bookings').get();
        const allBookings = allSnap.docs.map(d => d.data());
        const today = new Date().toDateString();

        const stats = {
            total: allBookings.length,
            today: allBookings.filter(b => new Date(b.createdAt?.toDate?.() || b.createdAt).toDateString() === today).length,
            active: allBookings.filter(b => b.status === 'active').length,
            completed: allBookings.filter(b => b.status === 'completed').length,
            cancelled: allBookings.filter(b => b.status === 'cancelled').length,
            totalEarnings: allBookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.amountPaid || 0), 0),
        };
        res.json(stats);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
