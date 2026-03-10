const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyAdmin } = require('../middleware/auth');

// Get all service categories
router.get('/', async (req, res) => {
    try {
        const categories = await prisma.serviceCategory.findMany({
            where: req.query.isActive === 'true' ? { isActive: true } : {},
            orderBy: { order: 'asc' }
        });
        res.json({ categories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create service category (Admin)
router.post('/', verifyAdmin, async (req, res) => {
    const { name, emoji, description, commissionPercent, order, isActive } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    try {
        const category = await prisma.serviceCategory.create({
            data: {
                name,
                emoji,
                description,
                commissionPercent: parseFloat(commissionPercent) || 0,
                order: parseInt(order) || 0,
                isActive: isActive !== false
            }
        });
        res.status(201).json(category);
    } catch (error) {
        console.error('Service Category Create Error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Update service category (Admin)
router.put('/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, emoji, description, commissionPercent, order, isActive } = req.body;

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) return res.status(400).json({ error: 'Invalid ID' });

    try {
        const data = {};
        if (name) data.name = name;
        if (emoji) data.emoji = emoji;
        if (description !== undefined) data.description = description;
        if (commissionPercent !== undefined) data.commissionPercent = parseFloat(commissionPercent) || 0;
        if (order !== undefined) data.order = parseInt(order) || 0;
        if (isActive !== undefined) data.isActive = isActive;

        const category = await prisma.serviceCategory.update({
            where: { id: parsedId },
            data
        });
        res.json(category);
    } catch (error) {
        console.error('Service Category Update Error:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
