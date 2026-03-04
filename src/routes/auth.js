const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateToken, verifyJWT } = require('../middleware/jwtAuth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, phone, gender, profilePhoto } = req.body;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ error: 'Email already in use' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword, name, phone: phone || '', gender: gender || 'Not Specified', profilePhoto: profilePhoto || null, onboardingCompleted: true, authProvider: 'email' },
        });

        const token = generateToken(user);
        res.status(201).json({ token, user: { uid: user.uid, email: user.email, name: user.name, profilePhoto: user.profilePhoto } });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        if (user.authProvider !== 'email') return res.status(400).json({ error: 'Please login using Google' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
        if (user.isBlocked) return res.status(403).json({ error: 'Account blocked' });

        const token = generateToken(user);
        res.json({ token, user: { uid: user.uid, email: user.email, name: user.name, profilePhoto: user.profilePhoto } });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/google — verify Firebase ID token, return JWT
router.post('/google', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ error: 'idToken required' });

        // Verify the Firebase ID token using Admin SDK
        const admin = require('../config/firebase');
        const decoded = await admin.auth().verifyIdToken(idToken);

        const { email, name, picture: photoUrl, uid: googleId } = decoded;
        if (!email) return res.status(400).json({ error: 'Email not found in token' });

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: { email, name: name || email.split('@')[0], profilePhoto: photoUrl || null, authProvider: 'google', googleId: googleId || '' },
            });
        }

        const token = generateToken(user);
        res.json({ token, user: { uid: user.uid, email: user.email, name: user.name, profilePhoto: user.profilePhoto } });
    } catch (err) {
        console.error('Google auth error:', err.message);
        if (err.code === 'auth/id-token-expired') return res.status(401).json({ error: 'Google token expired. Please sign in again.' });
        if (err.code === 'auth/argument-error') return res.status(401).json({ error: 'Invalid Google token.' });
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/auth/me
router.get('/me', verifyJWT, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { uid: req.user.uid }, omit: { password: true } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/auth/fcm-token
router.put('/fcm-token', verifyJWT, async (req, res) => {
    try {
        await prisma.user.update({ where: { uid: req.user.uid }, data: { fcmToken: req.body.fcmToken } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
