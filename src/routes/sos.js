const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyJWT } = require('../middleware/jwtAuth');

router.post('/', verifyJWT, async (req, res) => {
    try {
        const alert = await prisma.sosAlert.create({
            data: { userId: req.user.uid, bookingId: req.body.bookingId ? parseInt(req.body.bookingId) : null, providerId: req.body.providerId ? parseInt(req.body.providerId) : null, emergencyContact: req.body.emergencyContact || '' },
        });
        res.status(201).json({ message: 'SOS Triggered', alert });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/', async (req, res) => {
    try {
        const alerts = await prisma.sosAlert.findMany({ orderBy: { createdAt: 'desc' } });
        res.json({ alerts });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/resolve', async (req, res) => {
    try {
        await prisma.sosAlert.update({ where: { id: parseInt(req.params.id) }, data: { status: 'resolved' } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
