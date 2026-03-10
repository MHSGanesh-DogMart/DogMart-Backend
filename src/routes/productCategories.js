const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyAdmin } = require('../middleware/auth');

// Get all product categories
router.get('/', async (req, res) => {
    try {
        const categories = await prisma.productCategory.findMany({
            where: req.query.isActive === 'true' ? { isActive: true } : {},
            include: {
                subs: {
                    where: req.query.isActive === 'true' ? { isActive: true } : {},
                    orderBy: { order: 'asc' }
                }
            },
            orderBy: { order: 'asc' }
        });
        res.json({ categories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create product category (Admin)
router.post('/', verifyAdmin, async (req, res) => {
    const { name, emoji, order, isActive } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const category = await prisma.productCategory.create({
            data: {
                name,
                emoji,
                order: parseInt(order) || 0,
                isActive: isActive !== false
            }
        });
        res.status(201).json(category);
    } catch (error) {
        console.error('Product Category Create Error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Update product category (Admin)
router.put('/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, emoji, order, isActive } = req.body;
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) return res.status(400).json({ error: 'Invalid ID' });

    try {
        const data = {};
        if (name) data.name = name;
        if (emoji) data.emoji = emoji;
        if (order !== undefined) data.order = parseInt(order) || 0;
        if (isActive !== undefined) data.isActive = isActive;

        const category = await prisma.productCategory.update({
            where: { id: parsedId },
            data
        });
        res.json(category);
    } catch (error) {
        console.error('Product Category Update Error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Create sub-category (Admin)
router.post('/:id/subs', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, order, isActive } = req.body;
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) return res.status(400).json({ error: 'Invalid Category ID' });
    if (!name) return res.status(400).json({ error: 'Subcategory name is required' });

    try {
        const sub = await prisma.productSubCategory.create({
            data: {
                catId: parsedId,
                name,
                order: parseInt(order) || 0,
                isActive: isActive !== false
            }
        });
        res.status(201).json(sub);
    } catch (error) {
        console.error('Subcategory Create Error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Update sub-category (Admin)
router.put('/subs/:subId', verifyAdmin, async (req, res) => {
    const { subId } = req.params;
    const { name, order, isActive } = req.body;
    const parsedSubId = parseInt(subId);
    if (isNaN(parsedSubId)) return res.status(400).json({ error: 'Invalid Subcategory ID' });

    try {
        const data = {};
        if (name) data.name = name;
        if (order !== undefined) data.order = parseInt(order) || 0;
        if (isActive !== undefined) data.isActive = isActive;

        const sub = await prisma.productSubCategory.update({
            where: { id: parsedSubId },
            data
        });
        res.json(sub);
    } catch (error) {
        console.error('Subcategory Update Error:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
