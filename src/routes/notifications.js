const express = require('express');
const router = express.Router();
const { admin } = require('../config/firebase');
const { verifySelfOrAdmin } = require('../middleware/jwtAuth');
const { verifyAdmin } = require('../middleware/auth');

/**
 * POST /api/notifications/subscribe-admin
 * Subscribes a browser FCM token to the 'admin' topic
 * so all admin browsers get push when events happen.
 */
router.post('/subscribe-admin', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'token required' });
        await admin.messaging().subscribeToTopic([token], 'admin');
        console.log(`📢 Admin token subscribed to topic`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/notifications/unsubscribe-admin
 * Unsubscribes a token from the admin topic (e.g. logout)
 */
router.post('/unsubscribe-admin', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'token required' });
        await admin.messaging().unsubscribeFromTopic([token], 'admin');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/notifications/send-user (Admin Only)
 * Send a manual notification to a specific user (by userId or token) or to 'admin' topic
 * Body: { userId?, token?, title, body, data }
 */
router.post('/send-user', verifyAdmin, async (req, res) => {
    try {
        const { userId, token: directToken, title, body, data = {} } = req.body;

        // Setup payload data
        const payloadData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

        // 1. Check if routing to Admin Topic
        if (userId === 'admin') {
            console.log(`📢 Sending manual notification to Admin Topic`);
            const { sendToTopic } = require('../config/notifications');
            const result = await sendToTopic('admin', title, body, payloadData);
            return res.json({ success: true, messageId: result });
        }

        // 2. Route to Specific User
        let token = directToken;
        if (!token && userId) {
            const doc = await require('../config/firebase').db.collection('users').doc(userId).get();
            token = doc.exists ? doc.data()?.fcmToken : null;
        }

        if (!token) return res.status(404).json({ error: 'No FCM token found for user' });

        const { sendToToken } = require('../config/notifications');
        const result = await sendToToken(token, title, body, payloadData);

        res.json({ success: true, messageId: result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/notifications/chat-message
 * Trigged by clients when a new chat message is sent.
 * Body: { bookingId, senderType, senderName, messageText }
 */
router.post('/chat-message', async (req, res) => {
    try {
        const { bookingId, senderType, senderName, messageText } = req.body;

        if (!bookingId || !senderType) {
            return res.status(400).json({ error: 'bookingId and senderType required' });
        }

        const title = `New message from ${senderName}`;
        const body = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
        const payloadData = { screen: '/chat', bookingId }; // To let mobile app navigate to chat

        const { createAndSendNotification, createAndSendTopic } = require('../config/notifications');

        if (senderType === 'user') {
            // User sent it -> alert all Admins
            console.log(`📢 Sending chat notification to Admin Topic`);
            await createAndSendTopic('admin', title, body, payloadData, 'chat');
            return res.json({ success: true, notify: 'admin' });
        } else {
            // Admin sent it -> alert the specific user
            const bookingDoc = await require('../config/firebase').db.collection('bookings').doc(bookingId).get();
            if (!bookingDoc.exists) return res.status(404).json({ error: 'Booking not found' });

            const userId = bookingDoc.data().userId;

            console.log(`📢 Sending chat notification to User ${userId}`);
            await createAndSendNotification(userId, title, body, payloadData, 'chat');
            return res.json({ success: true, notify: 'user' });
        }
    } catch (e) {
        console.error('Error sending chat notification:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/notifications/user/:uid (Self or Admin)
 */
router.get('/user/:uid', verifySelfOrAdmin, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const notifications = await require('../config/database').prisma.notification.findMany({
            where: { userId: parseInt(req.params.uid) },
            orderBy: { createdAt: 'desc' },
            take: Number(limit)
        });
        res.json({ notifications });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', async (req, res) => {
    try {
        await require('../config/database').prisma.notification.update({
            where: { id: parseInt(req.params.id) },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /api/notifications/user/:uid/read-all (Self or Admin)
 */
router.put('/user/:uid/read-all', verifySelfOrAdmin, async (req, res) => {
    try {
        await require('../config/database').prisma.notification.updateMany({
            where: { userId: parseInt(req.params.uid), isRead: false },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
