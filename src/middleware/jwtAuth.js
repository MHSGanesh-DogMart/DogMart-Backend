const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-replace-in-production';

const verifyOptional = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded; // { uid, email, role }
        } catch (error) {
            // Ignore invalid token if optional
        }
    }
    next();
};

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

const generateToken = (user) => {
    return jwt.sign(
        { uid: user.uid || user._id, email: user.email, role: user.role || 'user' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

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
            const ADMIN_EMAILS = ['admin@dogmart.app', 'm.hemanth517@gmail.com'];
            const email = decodedAdmin.email.toLowerCase();
            if (decodedAdmin.admin || ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) {
                req.user = decodedAdmin;
                req.isAdmin = true;
                return next();
            }
        }

        // 2. Try Custom JWT Verify
        const decodedUser = jwt.verify(token, JWT_SECRET);

        if (decodedUser) {
            req.user = decodedUser;
            req.isAdmin = false;

            // Check if UID matches the target UID in params
            // We'll check for both 'id' and 'uid' param names
            const targetId = parseInt(req.params.id || req.params.uid);
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

module.exports = {
    verifyJWT,
    verifyOptional,
    verifySelfOrAdmin,
    generateToken,
    JWT_SECRET
};
