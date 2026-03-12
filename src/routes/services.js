const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyOptional } = require('../middleware/jwtAuth');

// GET /api/services - Get all service listings
router.get('/', verifyOptional, async (req, res) => {
    try {
        const { status = 'active', categoryId, categoryName, page = 1, limit = 10 } = req.query;
        const where = { type: 'service' };
        if (status) where.status = status;

        // If filtering by categoryName, resolve it to a categoryId first
        let resolvedCategoryId = categoryId ? parseInt(categoryId) : null;
        if (categoryName && !resolvedCategoryId) {
            const cat = await prisma.serviceCategory.findFirst({
                where: { name: { equals: categoryName, mode: 'insensitive' } },
            });
            if (cat) resolvedCategoryId = cat.id;
        }
        if (resolvedCategoryId) where.categoryId = resolvedCategoryId;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [listings, total] = await Promise.all([
            prisma.listing.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }),
            prisma.listing.count({ where }),
        ]);

        // Fetch category names for all unique categoryIds in one query
        const catIds = [...new Set(listings.map(l => l.categoryId).filter(Boolean))];
        const categories = catIds.length > 0
            ? await prisma.serviceCategory.findMany({ where: { id: { in: catIds } } })
            : [];
        const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

        const services = listings.map(l => ({
            ...l,
            id: String(l.id),
            userId: String(l.userId),
            categoryId: l.categoryId ? String(l.categoryId) : null,
            breedId: l.breedId ? String(l.breedId) : null,
            categoryName: catMap[l.categoryId]?.name ?? '',
            categoryEmoji: catMap[l.categoryId]?.emoji ?? '',
        }));

        res.json({ services, total, page: parseInt(page) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});


// POST /api/services - Create a service listing
router.post('/', verifyOptional, async (req, res) => {
    try {
        const doc = await prisma.listing.create({ data: { ...req.body, userId: parseInt(req.body.userId), type: 'service' } });
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
