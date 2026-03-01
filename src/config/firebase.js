require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  try {
    let serviceAccount;

    // 1. Try to load from Environment Variable (for Render/Production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
    // 2. Fallback to Local File (for local dev)
    else {
      const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
        : path.resolve(__dirname, '../../dogmart-backend/dog-mart-firebase-adminsdk.json');
      serviceAccount = require(keyPath);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || 'dog-mart-846bc',
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://dog-mart-846bc-default-rtdb.firebaseio.com',
    });
    console.log('✅ Firebase Admin SDK initialized (Firestore + Realtime DB) with credentials');
  } catch (e) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'dog-mart-846bc',
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://dog-mart-846bc-default-rtdb.firebaseio.com',
    });
    console.warn(`⚠️  Firebase Init Warning: ${e.message}`);
    console.warn('⚠️  Service account key not found. Some admin features (like DB writes) will fail.');
    console.warn('   Please set FIREBASE_SERVICE_ACCOUNT env var or add the .json file.');
  }
}

const db = admin.firestore();
const rtdb = admin.database();       // Realtime Database
const auth = admin.auth();

module.exports = { admin, db, rtdb, auth };

