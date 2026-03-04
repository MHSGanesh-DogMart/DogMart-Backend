const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyJWT } = require('../middleware/jwtAuth');

router.get('/', async (req, res) => {
    try {
        const where = {};
        if (req.query.isActive === 'true') where.isActive = true;
        const categories = await prisma.category.findMany({ where, orderBy: { createdAt: 'desc' } });
        res.json({ categories });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', verifyJWT, async (req, res) => {
    try {
        const cat = await prisma.category.create({ data: req.body });
        res.json({ success: true, id: cat.id, category: cat });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', verifyJWT, async (req, res) => {
    try {
        await prisma.category.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', verifyJWT, async (req, res) => {
    try {
        await prisma.category.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/toggle', verifyJWT, async (req, res) => {
    try {
        const cat = await prisma.category.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!cat) return res.status(404).json({ error: 'Category not found' });
        const updated = await prisma.category.update({ where: { id: cat.id }, data: { isActive: !cat.isActive } });
        res.json({ success: true, isActive: updated.isActive });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
