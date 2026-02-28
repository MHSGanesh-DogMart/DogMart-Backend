const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// GET all SOS alerts
router.get('/', async (req, res) => {
    try {
        const { resolved } = req.query;
        let query = db.collection('sos_alerts').orderBy('triggeredAt', 'desc');
        if (resolved !== undefined) query = query.where('resolved', '==', resolved === 'true');
        const snap = await query.get();
        const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ alerts });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH resolve SOS alert
router.patch('/:id/resolve', async (req, res) => {
    try {
        const { notes } = req.body;
        await db.collection('sos_alerts').doc(req.params.id).update({
            resolved: true, resolutionNotes: notes || '', resolvedAt: new Date()
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
