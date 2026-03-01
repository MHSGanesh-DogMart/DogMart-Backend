const express = require('express');
const router = express.Router();
const { admin } = require('../config/firebase');

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
 * POST /api/notifications/send-user
 * Send a manual notification to a specific user (by userId or token) or to 'admin' topic
 * Body: { userId?, token?, title, body, data }
 */
router.post('/send-user', async (req, res) => {
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

        const db = require('../config/firebase').db;

        if (senderType === 'user') {
            // User sent it -> alert all Admins
            console.log(`📢 Sending chat notification to Admin Topic`);

            // 1. Save to Firestore for Admin in-app notifications
            await db.collection('notifications').add({
                target: 'admin',
                title,
                body,
                data: Object.fromEntries(Object.entries(payloadData).map(([k, v]) => [k, String(v)])),
                isRead: false,
                createdAt: new Date()
            });

            // 2. Trigger FCM Push
            // 2. Trigger FCM Push using modern API helper
            const { sendToTopic } = require('../config/notifications');
            await sendToTopic('admin', title, body, payloadData);

            return res.json({ success: true, notify: 'admin' });
        } else {
            // Admin sent it -> alert the specific user
            const bookingDoc = await db.collection('bookings').doc(bookingId).get();
            if (!bookingDoc.exists) return res.status(404).json({ error: 'Booking not found' });

            const userId = bookingDoc.data().userId;

            // 1. Save to Firestore for User in-app notifications
            await db.collection('notifications').add({
                targetUserId: userId,
                title,
                body,
                data: Object.fromEntries(Object.entries(payloadData).map(([k, v]) => [k, String(v)])),
                isRead: false,
                createdAt: new Date()
            });

            // 2. Trigger FCM Push
            const userDoc = await db.collection('users').doc(userId).get();
            const token = userDoc.exists ? userDoc.data()?.fcmToken : null;

            if (!token) {
                console.log(`⚠️ No FCM token found for user ${userId} to receive chat notification.`);
                return res.json({ success: false, reason: 'No FCM token' });
            }

            console.log(`📢 Sending chat notification to User ${userId}`);
            await admin.messaging().send({
                token,
                notification: { title, body },
                data: Object.fromEntries(Object.entries(payloadData).map(([k, v]) => [k, String(v)])),
            });
            return res.json({ success: true, notify: 'user' });
        }
    } catch (e) {
        console.error('Error sending chat notification:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
