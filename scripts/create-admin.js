/**
 * DogMart — Create Admin User Script (REST API version)
 *
 * Uses Firebase Authentication REST API + Admin SDK to:
 * 1. Create admin@dogmart.com account via Firebase REST API
 * 2. Set admin: true custom claim via Admin SDK
 *
 * Run: node scripts/create-admin.js
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const https = require('https');

// ── Firebase web API key (from Firebase console → Project settings → General)
const WEB_API_KEY = 'AIzaSyBPbwHxNMQBytE-oPsXUizVZN6LFXkQJMo';

const ADMIN_EMAIL = 'admin@dogmart.com';
const ADMIN_PASSWORD = 'DogMart@2026'; // ⚠️ Change after first login!

// ── Init Admin SDK for custom claims
const keyPath = path.resolve('./dog-mart-firebase-adminsdk.json');
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(keyPath)), projectId: 'dog-mart-846bc' });
}
const auth = admin.auth();

// ── Helper: Firebase REST API call
function firebaseRestPost(endpoint, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const url = `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${WEB_API_KEY}`;
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        };
        const req = https.request(options, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                const parsed = JSON.parse(raw);
                if (parsed.error) reject(new Error(parsed.error.message));
                else resolve(parsed);
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('\n🔥 DogMart — Admin Account Setup\n');

    let uid;

    // Step 1: Try creating user via REST
    try {
        console.log(`📧 Creating Firebase user: ${ADMIN_EMAIL}...`);
        const result = await firebaseRestPost('accounts:signUp', {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            returnSecureToken: true,
        });
        uid = result.localId;
        console.log(`✅ User created! UID: ${uid}`);
    } catch (err) {
        if (err.message === 'EMAIL_EXISTS') {
            // User already exists — get UID via Admin SDK
            console.log('ℹ️  User already exists, fetching UID...');
            const existing = await auth.getUserByEmail(ADMIN_EMAIL);
            uid = existing.uid;
            console.log(`✅ Found existing user UID: ${uid}`);
        } else {
            throw err;
        }
    }

    // Step 2: Set admin custom claim via Admin SDK
    console.log('🔑 Setting admin custom claim...');
    await auth.setCustomUserClaims(uid, { admin: true });
    console.log('✅ Admin claim set!');

    // Step 3: Confirm
    const user = await auth.getUser(uid);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉  Admin account ready!');
    console.log(`   Email:     ${ADMIN_EMAIL}`);
    console.log(`   Password:  ${ADMIN_PASSWORD}`);
    console.log(`   UID:       ${uid}`);
    console.log(`   Claims:    ${JSON.stringify(user.customClaims)}`);
    console.log('   Login at:  http://localhost:5173');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  Change your password after first login via Settings!\n');
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Failed:', err.message);
    if (err.message.includes('CONFIGURATION_NOT_FOUND') || err.message.includes('API_KEY')) {
        console.error('   → Make sure Email/Password sign-in is enabled in Firebase Console');
        console.error('   → Firebase Console → Authentication → Sign-in method → Email/Password → Enable');
    }
    process.exit(1);
});
