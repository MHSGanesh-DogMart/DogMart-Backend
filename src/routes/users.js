const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyAdmin } = require('../middleware/auth');
const { verifyJWT } = require('../middleware/jwtAuth');

// Helper to check if user is admin OR accessing their own data
const verifySelfOrAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];

    try {
        // 1. Try Firebase Admin Verify
        const { auth } = require('../config/firebase');
        const decodedAdmin = await auth.verifyIdToken(token).catch(() => null);

        if (decodedAdmin) {
            // Check if actually an admin
            const ADMIN_EMAILS = ['admin@dogmart.app', 'm.hemanth517@gmail.com'];
            const email = decodedAdmin.email.toLowerCase();
            if (decodedAdmin.admin || ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) {
                req.user = decodedAdmin;
                req.isAdmin = true;
                return next();
            }
        }

        // 2. Try Custom JWT Verify
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../middleware/jwtAuth');
        const decodedUser = jwt.verify(token, JWT_SECRET);

        if (decodedUser) {
            req.user = decodedUser;
            req.isAdmin = false;

            // Check if UID matches the request ID
            const targetId = parseInt(req.params.id);
            if (decodedUser.uid !== targetId) {
                return res.status(403).json({ error: 'Access denied: You can only access your own data' });
            }
            return next();
        }

        throw new Error('Invalid token');
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized', detail: err.message });
    }
};

// GET all users (Admin Only)
router.get('/', verifyAdmin, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: Number(limit)
        });
        const usersWithStringIds = users.map(u => ({ ...u, uid: String(u.uid) }));
        const total = await prisma.user.count();
        res.json({ users: usersWithStringIds, total });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single user (Self or Admin)
router.get('/:id', verifySelfOrAdmin, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { uid: parseInt(req.params.id) }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET user subscriptions (Self or Admin)
router.get('/:id/subscriptions', verifySelfOrAdmin, async (req, res) => {
    try {
        const subscriptions = await prisma.subscription.findMany({
            where: { userId: parseInt(req.params.id) },
            orderBy: { createdAt: 'desc' }
        });
        const subsWithStringIds = subscriptions.map(s => ({ ...s, id: String(s.id) }));
        res.json({ subscriptions: subsWithStringIds });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH - block/unblock user (Admin Only)
router.patch('/:id/status', verifyAdmin, async (req, res) => {
    try {
        const { isBlocked } = req.body;
        await prisma.user.update({
            where: { uid: parseInt(req.params.id) },
            data: { isBlocked }
        });
        res.json({ success: true, message: isBlocked ? 'User blocked' : 'User unblocked' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/premium (Admin Only)
router.put('/:id/premium', verifyAdmin, async (req, res) => {
    try {
        const { isProvider } = req.body;
        await prisma.user.update({
            where: { uid: parseInt(req.params.id) },
            data: { isPremium: true } // Providers get premium access by default
        });
        res.json({ success: true, message: 'User upgraded successfully' });
    } catch (e) {
        console.error("Premium Upgrade Error:", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
