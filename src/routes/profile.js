const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyJWT } = require('../middleware/jwtAuth');

router.get('/', verifyJWT, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { uid: req.user.uid }, omit: { password: true } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.put('/', verifyJWT, async (req, res) => {
    try {
        const { uid, email, password, isBlocked, authProvider, googleId, ...updates } = req.body;
        const user = await prisma.user.update({ where: { uid: req.user.uid }, data: updates, omit: { password: true } });
        res.json({ message: 'Profile updated successfully', user });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
