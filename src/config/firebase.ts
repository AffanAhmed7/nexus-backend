import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

if (!admin.apps.length) {
    try {
        let credential;

        // Priority 1: FIREBASE_SERVICE_ACCOUNT env var (for production/Render)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            credential = admin.credential.cert(serviceAccount);
        }
        // Priority 2: Local serviceAccountKey.json file (for local dev)
        else {
            const localKeyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
            if (fs.existsSync(localKeyPath)) {
                credential = admin.credential.cert(localKeyPath);
            } else {
                credential = admin.credential.applicationDefault();
            }
        }

        admin.initializeApp({ credential });
    } catch (error) {
        console.error("Firebase init failed:", error);
    }
}

export default admin;

