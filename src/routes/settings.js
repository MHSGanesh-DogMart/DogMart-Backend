const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyAdmin } = require('../middleware/auth');

// GET all settings (Public - used by app for Help/Support details)
router.get('/', async (req, res) => {
    try {
        const settings = await prisma.appSetting.findMany();
        const settingsMap = {};
        settings.forEach(s => settingsMap[s.key] = s.value);
        res.json({ settings: settingsMap });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update settings (Admin only)
router.put('/', verifyAdmin, async (req, res) => {
    try {
        const { settings } = req.body; // Expects an object like { supportPhone: '...', supportEmail: '...' }
        const promises = [];

        for (const [key, value] of Object.entries(settings)) {
            promises.push(
                prisma.appSetting.upsert({
                    where: { key: String(key) },
                    update: { value: String(value) },
                    create: { key: String(key), value: String(value) }
                })
            );
        }

        await Promise.all(promises);
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (e) {
        console.error("Settings Update Error:", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
