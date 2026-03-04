const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyJWT } = require('../middleware/jwtAuth');

router.get('/', verifyJWT, async (req, res) => {
    try {
        const dogs = await prisma.dog.findMany({ where: { userId: req.user.uid }, orderBy: { createdAt: 'desc' } });
        res.json({ dogs });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', verifyJWT, async (req, res) => {
    try {
        const dog = await prisma.dog.create({ data: { ...req.body, userId: req.user.uid } });
        res.status(201).json({ message: 'Dog added successfully', dog });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', verifyJWT, async (req, res) => {
    try {
        const dog = await prisma.dog.findFirst({ where: { dogId: parseInt(req.params.id), userId: req.user.uid } });
        if (!dog) return res.status(404).json({ error: 'Dog not found or unauthorized' });
        await prisma.dog.delete({ where: { dogId: dog.dogId } });
        res.json({ message: 'Dog deleted successfully' });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
