const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyAdmin } = require('../middleware/auth');

// GET all sessions
router.get('/', verifyAdmin, async (req, res) => {
    try {
        const snap = await db.collection('categories').orderBy('createdAt', 'desc').get();
        const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ sessions, total: sessions.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create session
router.post('/', verifyAdmin, async (req, res) => {
    try {
        const data = {
            ...req.body,
            isAvailable: req.body.isAvailable !== false,
            rating: req.body.rating || 4.9,
            reviewCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const ref = await db.collection('categories').add(data);
        res.json({ id: ref.id, ...data });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update session
router.put('/:id', verifyAdmin, async (req, res) => {
    try {
        const data = { ...req.body, updatedAt: new Date() };
        await db.collection('categories').doc(req.params.id).update(data);
        res.json({ id: req.params.id, ...data });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH toggle availability
router.patch('/:id/toggle', verifyAdmin, async (req, res) => {
    try {
        const doc = await db.collection('categories').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Not found' });
        const isAvailable = !doc.data().isAvailable;
        await db.collection('categories').doc(req.params.id).update({ isAvailable, updatedAt: new Date() });
        res.json({ isAvailable });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE session
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        await db.collection('categories').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
