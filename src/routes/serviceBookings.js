const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { messaging } = require('../config/firebase');

// Commission rates per service category
const COMMISSION_RATES = {
    'Grooming': 0.20,
    'Walking': 0.15,
    'Boarding': 0.15,
};

// POST /api/service-bookings/create
// Called from Flutter after user confirms booking (before payment for now, or with mock payment)
router.post('/create', async (req, res) => {
    try {
        const {
            userId, providerId, dogId, dogName,
            serviceType, date, time, locationType,
            specialInstructions, amount
        } = req.body;

        if (!userId || !providerId || !serviceType || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const commissionRate = COMMISSION_RATES[serviceType] || 0.15;
        const platformCommission = Math.round(amount * commissionRate);
        const providerEarning = amount - platformCommission;

        const bookingRef = await db.collection('serviceBookings').add({
            userId,
            providerId,
            dogId: dogId || null,
            dogName: dogName || 'Unknown',
            serviceType,
            date,
            time,
            locationType: locationType || 'At My Home',
            specialInstructions: specialInstructions || '',
            amount,
            platformCommission,
            providerEarning,
            paymentId: `mock_svc_${Date.now()}`,
            status: 'pending',
            createdAt: new Date(),
        });

        // Notify provider
        try {
            const { sendToToken } = require('../config/notifications');
            const providerDoc = await db.collection('users').doc(providerId).get();
            const fcmToken = providerDoc.data()?.fcmToken;
            if (fcmToken) {
                await sendToToken(
                    fcmToken,
                    '🐾 New Booking Request!',
                    `${dogName || 'A dog'} needs ${serviceType} on ${date} at ${time}`,
                    { bookingId: bookingRef.id, type: 'new_booking' }
                );
            }
        } catch (fcmErr) {
            console.warn('FCM to provider failed:', fcmErr.message);
        }

        res.json({
            success: true,
            bookingId: bookingRef.id,
            commission: platformCommission,
            providerEarning,
        });
    } catch (e) {
        console.error('Create service booking error:', e);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/service-bookings/confirm
// Called by admin panel or provider confirm action
router.post('/confirm', async (req, res) => {
    try {
        const { bookingId, providerId } = req.body;

        const bookingRef = db.collection('serviceBookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) return res.status(404).json({ error: 'Booking not found' });

        const booking = bookingDoc.data();

        await bookingRef.update({
            status: 'confirmed',
            confirmedAt: new Date(),
        });

        // Notify user
        try {
            const { sendToToken } = require('../config/notifications');
            const userDoc = await db.collection('users').doc(booking.userId).get();
            const fcmToken = userDoc.data()?.fcmToken;
            if (fcmToken) {
                await sendToToken(
                    fcmToken,
                    '✅ Booking Confirmed!',
                    `Your ${booking.serviceType} on ${booking.date} at ${booking.time} is confirmed.`,
                    { bookingId, type: 'booking_confirmed' }
                );
            }
        } catch (fcmErr) {
            console.warn('FCM to user failed:', fcmErr.message);
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/service-bookings/reject
router.post('/reject', async (req, res) => {
    try {
        const { bookingId, reason } = req.body;

        const bookingRef = db.collection('serviceBookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) return res.status(404).json({ error: 'Booking not found' });

        const booking = bookingDoc.data();

        await bookingRef.update({
            status: 'rejected',
            providerNote: reason || 'Provider unavailable',
            rejectedAt: new Date(),
        });

        // Notify user
        try {
            const { sendToToken } = require('../config/notifications');
            const userDoc = await db.collection('users').doc(booking.userId).get();
            const fcmToken = userDoc.data()?.fcmToken;
            if (fcmToken) {
                await sendToToken(
                    fcmToken,
                    '❌ Booking Update',
                    `Your ${booking.serviceType} booking was rejected. Reason: ${reason || 'Provider unavailable'}`,
                    { bookingId, type: 'booking_rejected' }
                );
            }
        } catch (fcmErr) {
            console.warn('FCM failed:', fcmErr.message);
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/service-bookings/start
router.post('/start', async (req, res) => {
    try {
        const { bookingId } = req.body;
        const bookingRef = db.collection('serviceBookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();
        const booking = bookingDoc.data();

        await bookingRef.update({ status: 'active', sessionStartedAt: new Date() });

        // Notify both parties
        const targets = [booking.userId, booking.providerId];
        for (const uid of targets) {
            try {
                const { sendToToken } = require('../config/notifications');
                const userDoc = await db.collection('users').doc(uid).get();
                const fcmToken = userDoc.data()?.fcmToken;
                if (fcmToken) {
                    await sendToToken(
                        fcmToken,
                        '🚀 Session Started!',
                        `${booking.serviceType} session is now active. Timer running.`,
                        { bookingId, type: 'session_started' }
                    );
                }
            } catch (_) { }
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/service-bookings/complete
router.post('/complete', async (req, res) => {
    try {
        const { bookingId } = req.body;
        const bookingRef = db.collection('serviceBookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();
        const booking = bookingDoc.data();

        await bookingRef.update({ status: 'completed', completedAt: new Date() });

        // Prompt user to review
        try {
            const { sendToToken } = require('../config/notifications');
            const userDoc = await db.collection('users').doc(booking.userId).get();
            const fcmToken = userDoc.data()?.fcmToken;
            if (fcmToken) {
                await sendToToken(
                    fcmToken,
                    '⭐ How was your session?',
                    `Leave a review for your ${booking.serviceType} provider!`,
                    { bookingId, type: 'session_completed', providerId: booking.providerId }
                );
            }
        } catch (_) { }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/service-bookings — for admin panel
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let query = db.collection('serviceBookings').orderBy('createdAt', 'desc').limit(200);
        if (status && status !== 'all') {
            query = db.collection('serviceBookings').where('status', '==', status).orderBy('createdAt', 'desc').limit(200);
        }
        const snap = await query.get();
        const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ bookings });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/service-bookings/provider/:providerId
router.get('/provider/:providerId', async (req, res) => {
    try {
        const snap = await db.collection('serviceBookings')
            .where('providerId', '==', req.params.providerId)
            .orderBy('createdAt', 'desc')
            .get();
        const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ bookings });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/service-bookings/user/:userId
router.get('/user/:userId', async (req, res) => {
    try {
        const snap = await db.collection('serviceBookings')
            .where('userId', '==', req.params.userId)
            .orderBy('createdAt', 'desc')
            .get();
        const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ bookings });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
