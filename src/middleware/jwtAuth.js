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
        { expiresIn: '30d' }
    );
};

module.exports = {
    verifyJWT,
    verifyOptional,
    generateToken,
    JWT_SECRET
};
