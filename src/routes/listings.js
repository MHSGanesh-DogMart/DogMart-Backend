const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyJWT, verifyOptional } = require('../middleware/jwtAuth');

router.get('/', verifyOptional, async (req, res) => {
    try {
        const { status, categoryId, breedId, page = 1, limit = 10 } = req.query;
        const where = {};
        if (status) where.status = status;
        if (categoryId) where.categoryId = parseInt(categoryId);
        if (breedId) where.breedId = parseInt(breedId);

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [listings, total] = await Promise.all([
            prisma.listing.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }),
            prisma.listing.count({ where }),
        ]);
        res.json({ listings, total, page: parseInt(page) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/user/:userId', verifyOptional, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const listings = await prisma.listing.findMany({
            where: { userId: parseInt(req.params.userId) },
            orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit),
        });
        res.json({ listings });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', verifyOptional, async (req, res) => {
    try {
        const listing = await prisma.listing.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        res.json({ listing });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', verifyJWT, async (req, res) => {
    try {
        const listing = await prisma.listing.create({ data: { ...req.body, userId: req.user.uid } });
        res.status(201).json({ listing });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', verifyJWT, async (req, res) => {
    try {
        const listing = await prisma.listing.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        if (listing.userId !== req.user.uid) return res.status(403).json({ error: 'Unauthorized' });
        const updated = await prisma.listing.update({ where: { id: listing.id }, data: req.body });
        res.json({ listing: updated });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', verifyJWT, async (req, res) => {
    try {
        const listing = await prisma.listing.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        if (listing.userId !== req.user.uid) return res.status(403).json({ error: 'Unauthorized' });
        await prisma.listing.delete({ where: { id: listing.id } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
