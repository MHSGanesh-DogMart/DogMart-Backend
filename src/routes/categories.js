const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { prisma } = require('../config/database');
const { verifyAdmin } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../public/uploads/categories');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// POST upload category image
router.post('/upload', verifyAdmin, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = `/uploads/categories/${req.file.filename}`;
    res.json({ success: true, url: filePath });
});

router.get('/', async (req, res) => {
    try {
        const where = {};
        if (req.query.isActive === 'true') where.isActive = true;
        const categories = await prisma.category.findMany({ where, orderBy: { createdAt: 'desc' } });

        // Append host to relative paths
        const host = req.get('host');
        const protocol = req.protocol;
        const categoriesWithUrls = categories.map(cat => ({
            ...cat,
            id: String(cat.id), // Flutter expects String IDs
            imageUrl: cat.imageUrl && cat.imageUrl.startsWith('/')
                ? `${protocol}://${host}${cat.imageUrl}`
                : (cat.imageUrl || null)
        }));

        res.json({ categories: categoriesWithUrls });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', verifyAdmin, async (req, res) => {
    try {
        const data = { ...req.body };
        // Sanitize data
        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;

        // If imageUrl is a full URL, strip the host for storage if it's local
        if (data.imageUrl) {
            const host = req.get('host');
            data.imageUrl = data.imageUrl.replace(`${req.protocol}://${host}`, '');
        }
        const cat = await prisma.category.create({ data });
        res.json({ success: true, id: cat.id, category: cat });
    } catch (e) {
        console.error('Category Create Error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/:id', verifyAdmin, async (req, res) => {
    try {
        const data = { ...req.body };
        // Sanitize data
        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;

        if (data.imageUrl) {
            const host = req.get('host');
            data.imageUrl = data.imageUrl.replace(`${req.protocol}://${host}`, '');
        }
        await prisma.category.update({ where: { id: parseInt(req.params.id) }, data });
        res.json({ success: true });
    } catch (e) {
        console.error('Category Update Error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        await prisma.category.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/toggle', verifyAdmin, async (req, res) => {
    try {
        const cat = await prisma.category.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!cat) return res.status(404).json({ error: 'Category not found' });
        const updated = await prisma.category.update({ where: { id: cat.id }, data: { isActive: !cat.isActive } });
        res.json({ success: true, isActive: updated.isActive });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
