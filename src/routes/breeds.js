const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyAdmin } = require('../middleware/auth');

// GET all breeds
router.get('/', async (req, res) => {
    try {
        const { isActive } = req.query;
        const where = {};
        if (isActive === 'true') where.isActive = true;
        const breeds = await prisma.breed.findMany({ where, orderBy: { name: 'asc' } });
        const breedsWithStringIds = breeds.map(b => ({ ...b, id: String(b.id), categoryId: String(b.categoryId) }));
        res.json({ breeds: breedsWithStringIds });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create breed
router.post('/', verifyAdmin, async (req, res) => {
    const { name, size, categoryId, avgPriceMin, avgPriceMax, temperament, isActive } = req.body;

    // Validation
    if (!name || !categoryId) {
        return res.status(400).json({ error: 'Name and categoryId are required' });
    }

    const parsedCategoryId = parseInt(categoryId);
    if (isNaN(parsedCategoryId)) {
        return res.status(400).json({ error: 'Invalid categoryId' });
    }

    try {
        const breed = await prisma.breed.create({
            data: {
                name,
                size: size || 'Medium',
                categoryId: parsedCategoryId,
                avgPriceMin: parseFloat(avgPriceMin) || 0,
                avgPriceMax: parseFloat(avgPriceMax) || 0,
                temperament: temperament || '',
                isActive: isActive !== false
            }
        });
        res.json({ success: true, breed });
    } catch (e) {
        console.error('Breed Create Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// PUT update breed
router.put('/:id', verifyAdmin, async (req, res) => {
    const { name, size, categoryId, avgPriceMin, avgPriceMax, temperament, isActive } = req.body;
    const id = parseInt(req.params.id);

    if (isNaN(id)) return res.status(400).json({ error: 'Invalid breed id' });

    try {
        const data = {};
        if (name) data.name = name;
        if (size) data.size = size;
        if (categoryId) {
            const parsedCatId = parseInt(categoryId);
            if (!isNaN(parsedCatId)) data.categoryId = parsedCatId;
        }
        if (avgPriceMin !== undefined) data.avgPriceMin = parseFloat(avgPriceMin) || 0;
        if (avgPriceMax !== undefined) data.avgPriceMax = parseFloat(avgPriceMax) || 0;
        if (temperament !== undefined) data.temperament = temperament;
        if (isActive !== undefined) data.isActive = isActive;

        await prisma.breed.update({
            where: { id },
            data
        });
        res.json({ success: true });
    } catch (e) {
        console.error('Breed Update Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE breed
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        await prisma.breed.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH toggle status
router.patch('/:id/toggle', verifyAdmin, async (req, res) => {
    try {
        const breed = await prisma.breed.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!breed) return res.status(404).json({ error: 'Breed not found' });
        const updated = await prisma.breed.update({ where: { id: breed.id }, data: { isActive: !breed.isActive } });
        res.json({ success: true, isActive: updated.isActive });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
