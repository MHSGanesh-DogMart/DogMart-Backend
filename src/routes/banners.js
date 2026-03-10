const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { prisma } = require('../config/database');
const { verifyAdmin } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../public/uploads/banners');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// POST upload banner image
router.post('/upload', verifyAdmin, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = `/uploads/banners/${req.file.filename}`;
    res.json({ success: true, url: filePath });
});

// GET /api/banners (Public - for Mobile App)
router.get('/', async (req, res) => {
    try {
        const banners = await prisma.banner.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });

        const host = req.get('host');
        const protocol = req.protocol;
        const bannersWithUrls = banners.map(banner => ({
            ...banner,
            imageUrl: banner.imageUrl && banner.imageUrl.startsWith('/')
                ? `${protocol}://${host}${banner.imageUrl}`
                : banner.imageUrl
        }));

        res.json({ banners: bannersWithUrls });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/banners (Admin Only - all banners)
router.get('/all', verifyAdmin, async (req, res) => {
    try {
        const banners = await prisma.banner.findMany({
            orderBy: { createdAt: 'desc' },
        });

        // Append host to relative paths
        const host = req.get('host');
        const protocol = req.protocol;
        const bannersWithUrls = banners.map(banner => ({
            ...banner,
            imageUrl: banner.imageUrl && banner.imageUrl.startsWith('/')
                ? `${protocol}://${host}${banner.imageUrl}`
                : banner.imageUrl
        }));

        res.json({ banners: bannersWithUrls });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/banners
router.post('/', verifyAdmin, async (req, res) => {
    try {
        const { title, description, imageUrl, linkUrl, isActive, tag } = req.body;

        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        let finalImageUrl = imageUrl;
        if (finalImageUrl && finalImageUrl.startsWith('http')) {
            const host = req.get('host');
            finalImageUrl = finalImageUrl.replace(`${req.protocol}://${host}`, '');
        }

        const banner = await prisma.banner.create({
            data: {
                title: title || '',
                description: description || '',
                imageUrl: finalImageUrl,
                linkUrl: linkUrl || null,
                isActive: isActive !== undefined ? isActive : true,
                tag: tag || '',
            },
        });
        res.status(201).json({ banner });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/banners/:id
router.put('/:id', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const bannerId = parseInt(id, 10);
        if (isNaN(bannerId)) return res.status(400).json({ error: 'Invalid ID' });

        const data = { ...req.body };
        if (data.imageUrl && data.imageUrl.startsWith('http')) {
            const host = req.get('host');
            data.imageUrl = data.imageUrl.replace(`${req.protocol}://${host}`, '');
        }

        const banner = await prisma.banner.update({
            where: { id: bannerId },
            data,
        });
        res.json({ banner });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/admin/banners/:id
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const bannerId = parseInt(id, 10);
        if (isNaN(bannerId)) return res.status(400).json({ error: 'Invalid ID' });

        await prisma.banner.delete({
            where: { id: bannerId },
        });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
