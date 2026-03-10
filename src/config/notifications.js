/**
 * notifications.js — FCM send helper
 *
 * Usage:
 *   const { sendToToken, sendToTopic } = require('./notifications');
 *   await sendToToken(userFcmToken, 'New Booking!', 'You have a new booking.', { bookingId });
 *   await sendToTopic('admin', 'New Booking!', 'A new booking just came in.', { bookingId });
 */

const { admin } = require('./firebase');
const { prisma } = require('./database');

/**
 * Send to a specific device token (user notification).
 */
async function sendToToken(token, title, body, data = {}) {
    if (!token) return;
    try {
        const message = {
            token,
            notification: { title, body },
            data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
            android: { priority: 'high', notification: { sound: 'default', channelId: 'dogmart_main' } },
            apns: { payload: { aps: { sound: 'default', badge: 1 } } },
            webpush: {
                notification: { icon: '/logo192.png', badge: '/logo192.png', vibrate: [200, 100, 200] },
                fcmOptions: { link: '/' },
            },
        };
        const response = await admin.messaging().send(message);
        console.log(`📲 FCM sent to token: ${response}`);
        return response;
    } catch (e) {
        console.error('FCM sendToToken error:', e.message);
    }
}

/**
 * Send to a topic (e.g. 'admin' — all admin browsers subscribed to this topic).
 */
async function sendToTopic(topic, title, body, data = {}) {
    try {
        const message = {
            topic,
            notification: { title, body },
            data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
            webpush: {
                notification: {
                    title,
                    body,
                    icon: '/logo192.png',
                    badge: '/logo192.png',
                    vibrate: [200, 100, 200],
                    requireInteraction: true,
                    tag: topic,
                },
                fcmOptions: { link: '/' },
            },
        };
        const response = await admin.messaging().send(message);
        console.log(`📢 FCM sent to topic [${topic}]: ${response}`);
        return response;
    } catch (e) {
        console.error(`FCM sendToTopic [${topic}] error:`, e.message);
    }
}

/**
 * Send multicast — one notification to multiple tokens.
 */
async function sendMulticast(tokens, title, body, data = {}) {
    if (!tokens || tokens.length === 0) return;
    try {
        const message = {
            tokens,
            notification: { title, body },
            data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
        };
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`📲 FCM multicast: ${response.successCount} success, ${response.failureCount} failed`);
        return response;
    } catch (e) {
        console.error('FCM multicast error:', e.message);
    }
}

/**
 * Create notification in Postgres and send FCM to user
 */
async function createAndSendNotification(userId, title, body, data = {}, type = 'general') {
    try {
        // 1. Save to DB
        await prisma.notification.create({
            data: {
                userId: parseInt(userId),
                target: 'user',
                title,
                body,
                data,
                type
            }
        });

        // 2. Look up token and send FCM
        const user = await prisma.user.findUnique({ where: { uid: parseInt(userId) }, select: { fcmToken: true } });
        if (user && user.fcmToken) {
            await sendToToken(user.fcmToken, title, body, data);
        }
    } catch (e) {
        console.error('createAndSendNotification error:', e);
    }
}

/**
 * Create notification in Postgres and send FCM to topic
 */
async function createAndSendTopic(topic, title, body, data = {}, type = 'general') {
    try {
        // 1. Save to DB
        await prisma.notification.create({
            data: {
                userId: null,
                target: topic,
                title,
                body,
                data,
                type
            }
        });

        // 2. Send FCM
        await sendToTopic(topic, title, body, data);
    } catch (e) {
        console.error('createAndSendTopic error:', e);
    }
}

module.exports = { sendToToken, sendToTopic, sendMulticast, createAndSendNotification, createAndSendTopic };
