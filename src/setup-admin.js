const admin = require('firebase-admin');
const serviceAccount = require('../dog-mart-firebase-adminsdk.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

async function createAdmin() {
    const email = 'admin@dogmart.app';
    const password = 'admin123';

    try {
        let user;
        try {
            user = await admin.auth().getUserByEmail(email);
            console.log('User exists, updating password...');
            await admin.auth().updateUser(user.uid, { password });
        } catch (e) {
            console.log('User does not exist, creating...');
            user = await admin.auth().createUser({
                email,
                password,
                emailVerified: true
            });
        }

        // Add custom claim for admin if needed by the middleware
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });
        console.log(`Successfully set up ${email} with password: ${password}`);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

createAdmin().then(() => process.exit());
