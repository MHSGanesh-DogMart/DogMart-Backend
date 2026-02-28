const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// GET all reviews
router.get('/', async (req, res) => {
    try {
        const { flagged } = req.query;
        let query = db.collection('reviews').orderBy('createdAt', 'desc');
        if (flagged === 'true') query = query.where('flagged', '==', true);
        const snap = await query.get();
        const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ reviews });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH acknowledge flagged review
router.patch('/:id/acknowledge', async (req, res) => {
    try {
        await db.collection('reviews').doc(req.params.id).update({ acknowledged: true, updatedAt: new Date() });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE review
router.delete('/:id', async (req, res) => {
    try {
        await db.collection('reviews').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
