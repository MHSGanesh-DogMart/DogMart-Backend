const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// GET payment/earnings summary
router.get('/summary', async (req, res) => {
    try {
        const snap = await db.collection('bookings').where('status', '==', 'completed').get();
        const bookings = snap.docs.map(d => d.data());

        const now = new Date();
        const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const total = bookings.reduce((s, b) => s + (b.amountPaid || 0), 0);
        const thisWeek = bookings
            .filter(b => new Date(b.createdAt?.toDate?.() || b.createdAt) >= startOfWeek)
            .reduce((s, b) => s + (b.amountPaid || 0), 0);
        const thisMonth = bookings
            .filter(b => new Date(b.createdAt?.toDate?.() || b.createdAt) >= startOfMonth)
            .reduce((s, b) => s + (b.amountPaid || 0), 0);

        // Earnings by session type
        const byType = {};
        bookings.forEach(b => {
            const type = b.sessionType || 'unknown';
            byType[type] = (byType[type] || 0) + (b.amountPaid || 0);
        });

        res.json({ total, thisWeek, thisMonth, byType });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all transactions
router.get('/transactions', async (req, res) => {
    try {
        const snap = await db.collection('bookings')
            .where('status', '==', 'completed')
            .orderBy('createdAt', 'desc')
            .limit(200)
            .get();
        const txns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ transactions: txns });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /subscribe (MOCK RAZORPAY PAYMENT)
router.post('/subscribe', async (req, res) => {
    try {
        const { userId, planType = 'monthly' } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const now = new Date();
        const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // 1. Update the User Profile
        await db.collection('users').doc(userId).update({
            isPremium: true,
            subscriptionEnd: thirtyDaysLater,
            subscriptionId: `mock_sub_${Date.now()}`
        });

        // 2. Log exactly to the subscriptions table to power the Admin Panel revenue charts
        await db.collection('subscriptions').add({
            userId,
            planType,
            amount: 99,
            startDate: now,
            endDate: thirtyDaysLater,
            razorpayPaymentId: `mock_pay_${Date.now()}`,
            razorpayOrderId: `mock_order_${Date.now()}`,
            status: 'active',
            createdAt: now
        });

        res.json({ success: true, message: 'Mock payment verified. User is now Premium.' });
    } catch (e) {
        console.error("Subscription Error:", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
