const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyJWT, verifyOptional } = require('../middleware/jwtAuth');
const { createAndSendNotification } = require('../config/notifications');

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
        const listingsWithStringIds = listings.map(l => ({
            ...l,
            id: String(l.id),
            userId: String(l.userId),
            categoryId: l.categoryId ? String(l.categoryId) : null,
            breedId: l.breedId ? String(l.breedId) : null
        }));
        res.json({ listings: listingsWithStringIds, total, page: parseInt(page) });
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
        const listingsWithStringIds = listings.map(l => ({
            ...l,
            id: String(l.id),
            userId: String(l.userId),
            categoryId: l.categoryId ? String(l.categoryId) : null,
            breedId: l.breedId ? String(l.breedId) : null
        }));
        res.json({ listings: listingsWithStringIds });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', verifyOptional, async (req, res) => {
    try {
        const listing = await prisma.listing.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        const listingWithStringIds = {
            ...listing,
            id: String(listing.id),
            userId: String(listing.userId),
            categoryId: listing.categoryId ? String(listing.categoryId) : null,
            breedId: listing.breedId ? String(listing.breedId) : null
        };
        res.json({ listing: listingWithStringIds });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', verifyJWT, async (req, res) => {
    try {
        const { categoryId, breedId, ...data } = req.body;
        const listing = await prisma.listing.create({
            data: {
                ...data,
                status: 'active',
                userId: parseInt(req.user.uid),
                categoryId: categoryId ? parseInt(categoryId) : null,
                breedId: breedId ? parseInt(breedId) : null,
            }
        });

        // Auto-increment user's listing count
        await prisma.user.update({
            where: { uid: parseInt(req.user.uid) },
            data: { freeListingsUsed: { increment: 1 } }
        });

        // Send a notification to the creator
        await createAndSendNotification(
            req.user.uid,
            listing.type === 'service' ? 'Service Created 🛠️' : 'Pet Listed 🐶',
            `Your listing "${listing.title || listing.breed}" is now live!`,
            { listingId: listing.id, type: listing.type },
            'general'
        );

        res.status(201).json({ listing });
    } catch (e) {
        console.error('Create listing error:', e);
        res.status(500).json({ error: e.message });
    }
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
