const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const Razorpay = require('razorpay');
const crypto = require('crypto');

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

// POST /create-order (Generate Razorpay Order ID)
router.post('/create-order', async (req, res) => {
    try {
        const { amount = 99 } = req.body;

        // Initialize Razorpay dynamically from environment variables
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const options = {
            amount: amount * 100, // amount in smallest currency unit (paise)
            currency: "INR",
            receipt: `receipt_order_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
    } catch (e) {
        console.error("Razorpay Order Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /verify-payment (Secure Signature Validation)
router.post('/verify-payment', async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            userId,
            planType = 'monthly'
        } = req.body;

        if (!userId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Missing payment details or User ID' });
        }

        // 1. Verify Signature Securely
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({ error: "Invalid payment signature" });
        }

        // 2. Signature is valid. Upgrade User Profile.
        const now = new Date();
        const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await db.collection('users').doc(userId).update({
            isPremium: true,
            subscriptionEnd: thirtyDaysLater,
            subscriptionId: razorpay_order_id
        });

        // 3. Log exactly to the subscriptions table to power Admin Panel revenue charts
        await db.collection('subscriptions').add({
            userId,
            planType,
            amount: 99,
            startDate: now,
            endDate: thirtyDaysLater,
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            status: 'active',
            createdAt: now
        });

        res.json({ success: true, message: 'Payment verified successfully. User is now Premium.' });
    } catch (e) {
        console.error("Verification Error:", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
