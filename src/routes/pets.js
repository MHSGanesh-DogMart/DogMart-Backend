const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyOptional } = require('../middleware/jwtAuth');

// GET /api/pets - Get all pet listings
router.get('/', verifyOptional, async (req, res) => {
    try {
        const { status = 'active', categoryId, breedId, page = 1, limit = 10 } = req.query;
        const where = { type: 'sale' };
        if (status) where.status = status;
        if (categoryId) where.categoryId = parseInt(categoryId);
        if (breedId) where.breedId = parseInt(breedId);

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [listings, total] = await Promise.all([
            prisma.listing.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }),
            prisma.listing.count({ where }),
        ]);

        const pets = listings.map(l => ({
            ...l,
            id: String(l.id),
            userId: String(l.userId),
            categoryId: l.categoryId ? String(l.categoryId) : null,
            breedId: l.breedId ? String(l.breedId) : null
        }));

        res.json({ pets, total, page: parseInt(page) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/pets - Create a pet listing
router.get('/', verifyOptional, async (req, res) => {
    // Already defined above
});

router.post('/', verifyOptional, async (req, res) => {
    try {
        const doc = await prisma.listing.create({ data: { ...req.body, userId: parseInt(req.body.userId), type: 'sale' } });
        res.status(201).json({ ...doc, id: String(doc.id) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', verifyOptional, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const doc = await prisma.listing.update({ where: { id }, data: req.body });
        res.json({ ...doc, id: String(doc.id) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
