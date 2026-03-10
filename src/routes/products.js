const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { verifyAdmin } = require('../middleware/auth');
const { verifyJWT, verifyOptional } = require('../middleware/jwtAuth');
const { createAndSendNotification } = require('../config/notifications');

// Create a product
router.post('/', verifyJWT, async (req, res) => {
    const {
        sellerId,
        catId,
        subCatId,
        name,
        brand,
        suitableFor,
        petSize,
        ageGroup,
        description,
        keyFeatures,
        hasVariants,
        mrp,
        sellingPrice,
        stock,
        images,
        deliveryOptions,
        deliveryCharge,
        deliveryType,
        deliveryFreeAbove,
        deliveryDays,
        returnPolicy,
        variants
    } = req.body;

    try {
        const product = await prisma.product.create({
            data: {
                sellerId: parseInt(req.user.uid) || parseInt(sellerId),
                catId: parseInt(catId),
                subCatId: subCatId ? parseInt(subCatId) : null,
                name,
                brand,
                suitableFor: suitableFor || [],
                petSize: petSize || [],
                ageGroup: ageGroup || [],
                description,
                keyFeatures: keyFeatures || [],
                hasVariants: !!hasVariants,
                mrp: mrp ? parseFloat(mrp) : null,
                sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
                stock: stock ? parseInt(stock) : null,
                images: images || [],
                deliveryOptions: deliveryOptions || [],
                deliveryCharge: parseFloat(deliveryCharge) || 0,
                deliveryType: deliveryType || 'fixed',
                deliveryFreeAbove: deliveryFreeAbove ? parseFloat(deliveryFreeAbove) : null,
                deliveryDays,
                returnPolicy: returnPolicy || 'none',
                status: 'active',
                variants: hasVariants && variants ? {
                    create: variants.map(v => ({
                        name: v.name,
                        mrp: parseFloat(v.mrp),
                        price: parseFloat(v.price),
                        stock: parseInt(v.stock)
                    }))
                } : undefined
            },
            include: { variants: true }
        });

        // Send a notification to the seller
        const uid = parseInt(req.user.uid) || parseInt(sellerId);
        await createAndSendNotification(
            uid,
            'Product Created 🛍️',
            `Your product "${name}" is now live!`,
            { productId: product.id },
            'general'
        );

        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all products (with filters)
router.get('/', async (req, res) => {
    const { catId, subCatId, status, sellerId } = req.query;
    const where = {};
    if (catId) where.catId = parseInt(catId);
    if (subCatId) where.subCatId = parseInt(subCatId);
    if (status) where.status = status;
    if (sellerId) where.sellerId = parseInt(sellerId);

    try {
        const products = await prisma.product.findMany({
            where,
            include: { category: true, subcategory: true, variants: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ products });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get product details
router.get('/:id', async (req, res) => {
    try {
        const product = await prisma.product.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { category: true, subcategory: true, variants: true }
        });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update product status (Admin)
router.patch('/:id/status', verifyAdmin, async (req, res) => {
    const { status } = req.body;
    try {
        const product = await prisma.product.update({
            where: { id: parseInt(req.params.id) },
            data: { status }
        });
        res.json(product);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete product (Admin or Seller, but here Admin)
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        // Find product to handle variant deletion if necessary (Prisma cascade might handle it depending on schema)
        // Since schema for ProductVariant doesn't explicitly state onDelete: Cascade, we should delete variants first.
        await prisma.productVariant.deleteMany({
            where: { productId: parseInt(req.params.id) }
        });
        const product = await prisma.product.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ success: true, message: 'Product deleted', product });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
