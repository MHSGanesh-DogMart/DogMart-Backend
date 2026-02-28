const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// GET all users
router.get('/', async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;
        let query = db.collection('users').orderBy('createdAt', 'desc').limit(Number(limit));
        if (status) query = query.where('status', '==', status);
        const snap = await query.get();
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ users, total: users.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single user
router.get('/:id', async (req, res) => {
    try {
        const doc = await db.collection('users').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'User not found' });
        res.json({ id: doc.id, ...doc.data() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH - block/unblock user
router.patch('/:id/status', async (req, res) => {
    try {
        const { isBlocked } = req.body;
        await db.collection('users').doc(req.params.id).update({ isBlocked, updatedAt: new Date() });
        res.json({ success: true, message: isBlocked ? 'User blocked' : 'User unblocked' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET user bookings
router.get('/:id/bookings', async (req, res) => {
    try {
        const snap = await db.collection('bookings').where('userId', '==', req.params.id).orderBy('createdAt', 'desc').get();
        const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ bookings });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET user reviews
router.get('/:id/reviews', async (req, res) => {
    try {
        const snap = await db.collection('reviews').where('userId', '==', req.params.id).orderBy('createdAt', 'desc').get();
        const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ reviews });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
