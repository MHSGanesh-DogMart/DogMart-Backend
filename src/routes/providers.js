const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyJWT } = require('../middleware/jwtAuth');

router.post('/register', verifyJWT, async (req, res) => {
    try {
        const existing = await prisma.serviceProvider.findUnique({ where: { userId: req.user.uid } });
        if (existing) return res.status(400).json({ error: 'Already registered' });
        const provider = await prisma.serviceProvider.create({ data: { ...req.body, userId: req.user.uid } });
        res.status(201).json({ message: 'Registered successfully', provider });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:userId', async (req, res) => {
    try {
        const provider = await prisma.serviceProvider.findUnique({ where: { userId: parseInt(req.params.userId) } });
        if (!provider) return res.status(404).json({ error: 'Provider not found' });
        res.json({ provider });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/availability/me', verifyJWT, async (req, res) => {
    try {
        const availability = await prisma.providerAvailability.findUnique({ where: { providerId: req.user.uid } });
        res.json({ availability: availability || {} });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/availability/me', verifyJWT, async (req, res) => {
    try {
        const availability = await prisma.providerAvailability.upsert({
            where: { providerId: req.user.uid },
            update: req.body,
            create: { ...req.body, providerId: req.user.uid },
        });
        res.json({ message: 'Availability updated', availability });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
