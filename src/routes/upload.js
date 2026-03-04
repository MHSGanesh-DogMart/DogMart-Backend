const express = require('express');
const router = express.Router();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const { verifyJWT } = require('../middleware/jwtAuth');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key'
    }
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'dogmart-storage';

/**
 * @swagger
 * tags:
 *   name: File Storage
 *   description: AWS S3 File Management
 */

/**
 * @swagger
 * /api/upload/presigned-url:
 *   get:
 *     summary: Get a pre-signed URL to upload a file directly to AWS S3
 *     tags: [File Storage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: folder
 *         schema:
 *           type: string
 *         description: Folder name in S3 bucket (e.g., 'profile_photos', 'dogs')
 *     responses:
 *       200:
 *         description: Pre-signed URL generated successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/presigned-url', verifyJWT, async (req, res) => {
    try {
        const folder = req.query.folder || 'misc';
        const fileKey = `${folder}/${uuidv4()}.jpg`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileKey,
            ContentType: 'image/jpeg',
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        // The Flutter app will PUT the file to `uploadUrl`
        // The final public URL of the file will be this:
        const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileKey}`;

        res.json({ uploadUrl, publicUrl, fileKey });
    } catch (err) {
        console.error("Presigned URL Error:", err);
        res.status(500).json({ error: 'Failed to generate pre-signed URL' });
    }
});

module.exports = router;
