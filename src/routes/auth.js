const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateToken, verifyJWT } = require('../middleware/jwtAuth');
const sendEmail = require('../utils/sendEmail');
const { createAndSendNotification } = require('../config/notifications');

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

        // Welcome Notification (Saves to DB inbox even if FCM isn't attached yet)
        await createAndSendNotification(
            user.uid,
            'Welcome to DogMart! 🐾',
            'Find the perfect furry friend or the best services for your dog.',
            {},
            'general'
        );

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
        const { auth } = require('../config/firebase');
        const decoded = await auth.verifyIdToken(idToken);

        const { email, name, picture: photoUrl, uid: googleId } = decoded;
        if (!email) return res.status(400).json({ error: 'Email not found in token' });

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } });
        let isNewUser = false;
        if (!user) {
            isNewUser = true;
            user = await prisma.user.create({
                data: { email, name: name || email.split('@')[0], profilePhoto: photoUrl || null, authProvider: 'google', googleId: googleId || '' },
            });
        }

        const token = generateToken(user);

        if (isNewUser) {
            await createAndSendNotification(
                user.uid,
                'Welcome to DogMart! 🐾',
                'Find the perfect furry friend or the best services for your dog.',
                {},
                'general'
            );
        }

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

// POST /api/auth/fcm-token
router.put('/fcm-token', verifyJWT, async (req, res) => {
    try {
        await prisma.user.update({ where: { uid: req.user.uid }, data: { fcmToken: req.body.fcmToken } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        // Upsert OTP in DB
        await prisma.otp.upsert({
            where: { email },
            update: { code: otpCode, expiresAt },
            create: { email, code: otpCode, expiresAt },
        });

        // Send Email
        const sent = await sendEmail({
            email,
            subject: 'DogMart - Your Verification Code',
            text: `Your verification code is: ${otpCode}. It expires in 10 minutes.`,
            html: `<h3>DogMart Login</h3><p>Your verification code is: <b>${otpCode}</b></p><p>It expires in 10 minutes.</p>`
        });

        if (sent) {
            res.json({ success: true, message: 'OTP sent successfully' });
        } else {
            res.status(500).json({ error: 'Failed to send email' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

        const otpRecord = await prisma.otp.findUnique({ where: { email } });
        if (!otpRecord || otpRecord.code !== otp) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        if (new Date() > otpRecord.expiresAt) {
            return res.status(400).json({ error: 'Verification code expired' });
        }

        // Delete OTP after successful verification
        await prisma.otp.delete({ where: { email } });

        // Check if user exists
        let user = await prisma.user.findUnique({ where: { email } });
        let isNewUser = false;

        if (!user) {
            // We return a flag for new user, the frontend will redirect to profile setup
            isNewUser = true;
            // Potentially create a placeholder user or just rely on the frontend to call register later
            // Here we'll return a special status or a partial token if needed.
            // But for now, let's just say "verified" and let the frontend handle Registration.
            return res.json({ success: true, verified: true, isNewUser: true });
        }

        if (user.isBlocked) return res.status(403).json({ error: 'Account blocked' });

        const token = generateToken(user);
        res.json({
            success: true,
            token,
            isNewUser: false,
            user: { uid: user.uid, email: user.email, name: user.name, profilePhoto: user.profilePhoto }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
