const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// GET all locations
router.get('/', async (req, res) => {
    try {
        const { area, type } = req.query;
        let query = db.collection('locations').orderBy('createdAt', 'desc');
        if (area) query = query.where('area', '==', area);
        if (type) query = query.where('type', '==', type);
        const snap = await query.get();
        const locations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ locations });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create location
router.post('/', async (req, res) => {
    try {
        const { name, area, type, address, mapsLink, latitude, longitude, isActive } = req.body;
        const docRef = await db.collection('locations').add({
            name, area, type, address, mapsLink,
            coordinates: { latitude, longitude },
            isActive: isActive !== undefined ? isActive : true,
            createdAt: new Date(), updatedAt: new Date()
        });
        res.json({ success: true, id: docRef.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update location
router.put('/:id', async (req, res) => {
    try {
        await db.collection('locations').doc(req.params.id).update({ ...req.body, updatedAt: new Date() });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE location
router.delete('/:id', async (req, res) => {
    try {
        await db.collection('locations').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH toggle active
router.patch('/:id/toggle', async (req, res) => {
    try {
        const doc = await db.collection('locations').doc(req.params.id).get();
        const current = doc.data().isActive;
        await db.collection('locations').doc(req.params.id).update({ isActive: !current, updatedAt: new Date() });
        res.json({ success: true, isActive: !current });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
