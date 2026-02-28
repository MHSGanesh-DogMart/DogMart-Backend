require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  try {
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      : path.resolve(__dirname, '../../dog-mart-firebase-adminsdk.json');

    const serviceAccount = require(keyPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || 'dog-mart-846bc',
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://dog-mart-846bc-default-rtdb.firebaseio.com',
    });
    console.log('✅ Firebase Admin SDK initialized (Firestore + Realtime DB)');
  } catch (e) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'dog-mart-846bc',
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://dog-mart-846bc-default-rtdb.firebaseio.com',
    });
    console.warn('⚠️  Service account key not found. Some admin features limited.');
    console.warn('   Expected: dog-mart-firebase-adminsdk.json');
  }
}

const db = admin.firestore();
const rtdb = admin.database();       // Realtime Database
const auth = admin.auth();

module.exports = { admin, db, rtdb, auth };

