const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// GET all categories
router.get('/', async (req, res) => {
    try {
        const snap = await db.collection('categories').orderBy('createdAt', 'desc').get();
        const categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ categories });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create category
router.post('/', async (req, res) => {
    try {
        const { name, emoji, description, durationHours, pricePerHour, priceType, maxPerDay, isActive } = req.body;
        const docRef = await db.collection('categories').add({
            name, emoji, description, durationHours, pricePerHour,
            priceType: priceType || 'fixed',
            maxPerDay: maxPerDay || 1,
            isActive: isActive !== undefined ? isActive : true,
            createdAt: new Date(), updatedAt: new Date()
        });
        res.json({ success: true, id: docRef.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update category
router.put('/:id', async (req, res) => {
    try {
        await db.collection('categories').doc(req.params.id).update({ ...req.body, updatedAt: new Date() });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE category
router.delete('/:id', async (req, res) => {
    try {
        await db.collection('categories').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH toggle active
router.patch('/:id/toggle', async (req, res) => {
    try {
        const doc = await db.collection('categories').doc(req.params.id).get();
        const current = doc.data().isActive;
        await db.collection('categories').doc(req.params.id).update({ isActive: !current, updatedAt: new Date() });
        res.json({ success: true, isActive: !current });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
