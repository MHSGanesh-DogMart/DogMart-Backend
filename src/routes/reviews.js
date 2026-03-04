const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyJWT } = require('../middleware/jwtAuth');

router.post('/', verifyJWT, async (req, res) => {
    try {
        const review = await prisma.review.create({
            data: { targetId: parseInt(req.body.providerId || req.body.targetId), reviewerId: req.user.uid, reviewerName: req.body.reviewerName || '', rating: req.body.rating, comment: req.body.comment || '' },
        });
        try {
            const allReviews = await prisma.review.findMany({ where: { targetId: parseInt(req.body.providerId) } });
            const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
            await prisma.serviceProvider.update({ where: { userId: parseInt(req.body.providerId) }, data: { rating: parseFloat(avg.toFixed(1)), reviewCount: allReviews.length } });
        } catch (_) { }
        res.status(201).json({ message: 'Review submitted', review });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/', async (req, res) => {
    try {
        const where = req.query.targetId ? { targetId: parseInt(req.query.targetId) } : {};
        const reviews = await prisma.review.findMany({ where, orderBy: { createdAt: 'desc' } });
        res.json({ reviews });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
