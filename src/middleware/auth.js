const { auth } = require('../config/firebase');

const ADMIN_EMAILS = [
    'admin@dogmart.app',
    // Add more admin emails here if needed
];

const verifyAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decoded = await auth.verifyIdToken(idToken);

        // Admin check: either has admin custom claim OR is in the admin emails list
        if (!decoded.admin && !ADMIN_EMAILS.includes(decoded.email)) {
            return res.status(403).json({ error: 'Admin access only' });
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token', detail: err.message });
    }
};

module.exports = { verifyAdmin };
