const { auth } = require('../config/firebase');

const ADMIN_EMAILS = [
    'admin@dogmart.app',
    'm.hemanth517@gmail.com', // Added developer email
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
        const email = decoded.email.toLowerCase();

        // Admin check: either has admin custom claim OR is in the explicitly allowed list
        // This ensures 'old' firebase admins with the 'admin' claim still have access.
        if (!decoded.admin && !ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) {
            console.warn(`⛔ Access denied for ${email}: Not an admin.`);
            return res.status(403).json({ error: `Admin access only. ${email} is not authorized.` });
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token', detail: err.message });
    }
};

module.exports = { verifyAdmin };
