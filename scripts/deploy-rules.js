/**
 * deploy-rules.js — Deploy Firestore rules via REST API using service account
 * Run: node scripts/deploy-rules.js
 */
const admin = require('firebase-admin');
const https = require('https');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../accompany-e9305-firebase-adminsdk-fbsvc-c30c352c7c.json');
const PROJECT_ID = 'accompany-e9305';

const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /bookings/{bookingId} {
      allow read, write: if request.auth != null;
    }
    match /sessions/{sessionId} {
      allow read: if true;
      allow write: if false;
    }
    match /reviews/{reviewId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /sos_alerts/{alertId} {
      allow read, write: if request.auth != null;
    }
    match /categories/{id} { allow read: if true; allow write: if false; }
    match /locations/{id}  { allow read: if true; allow write: if false; }
  }
}`;

const RTDB_RULES = {
    rules: {
        active_sessions: { '.read': 'auth != null', '.write': 'auth != null' },
        sos: { '.read': 'auth != null', '.write': 'auth != null' },
        stats: { '.read': 'auth != null', '.write': 'auth != null' },
    }
};

function httpsRequest(hostname, path, method, token, bodyObj) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(bodyObj);
        const req = https.request({
            hostname, path, method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            }
        }, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function deployFirestoreRules(token) {
    // 1. Create ruleset
    const rs = await httpsRequest(
        'firebaserules.googleapis.com',
        `/v1/projects/${PROJECT_ID}/rulesets`,
        'POST', token,
        { source: { files: [{ content: FIRESTORE_RULES, name: 'firestore.rules' }] } }
    );
    if (rs.status < 200 || rs.status >= 300) {
        throw new Error('Create ruleset failed: ' + rs.body);
    }
    const rulesetName = JSON.parse(rs.body).name;
    console.log('  Ruleset created:', rulesetName);

    // 2. Create a new Release (POST — creates the release if not exists)
    const releaseBody = {
        name: `projects/${PROJECT_ID}/releases/cloud.firestore`,
        rulesetName,
    };
    let rel = await httpsRequest(
        'firebaserules.googleapis.com',
        `/v1/projects/${PROJECT_ID}/releases`,
        'POST', token,
        releaseBody
    );
    // If release already exists (409), patch it
    if (rel.status === 409) {
        rel = await httpsRequest(
            'firebaserules.googleapis.com',
            `/v1/${releaseBody.name}`,
            'PUT', token,
            releaseBody
        );
    }
    if (rel.status < 200 || rel.status >= 300) {
        throw new Error('Release failed: ' + rel.body);
    }
    console.log('✅ Firestore rules deployed!');
}

async function deployRtdbRules(token) {
    const res = await httpsRequest(
        'accompany-e9305-default-rtdb.firebaseio.com',
        '/.settings/rules.json',
        'PUT', token,
        RTDB_RULES
    );
    if (res.status < 200 || res.status >= 300) {
        throw new Error('RTDB deploy failed: ' + res.body);
    }
    console.log('✅ Realtime Database rules deployed!');
}

async function main() {
    console.log('🚀 Deploying Firebase security rules...\n');
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    const tokenRes = await admin.app().options.credential.getAccessToken();
    const token = tokenRes.access_token;

    await deployFirestoreRules(token);
    await deployRtdbRules(token);
    console.log('\n🎉 All rules deployed successfully!');
    process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
