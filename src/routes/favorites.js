const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyJWT } = require('../middleware/jwtAuth');

router.get('/', verifyJWT, async (req, res) => {
    try {
        const favorites = await prisma.favorite.findMany({ where: { userId: req.user.uid }, orderBy: { createdAt: 'desc' } });
        res.json({ favorites: favorites.map(f => f.listingId) });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/toggle', verifyJWT, async (req, res) => {
    try {
        const listingId = parseInt(req.body.listingId);
        const existing = await prisma.favorite.findUnique({ where: { userId_listingId: { userId: req.user.uid, listingId } } });
        if (existing) {
            await prisma.favorite.delete({ where: { id: existing.id } });
            return res.json({ isFavorite: false, message: 'Removed from favorites' });
        }
        await prisma.favorite.create({ data: { userId: req.user.uid, listingId } });
        res.json({ isFavorite: true, message: 'Added to favorites' });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
