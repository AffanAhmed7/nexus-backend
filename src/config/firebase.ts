import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
// Ideally, you should use a service account key file or environment variables
// For now, we will try to use the default application credentials or environment variables
// If the user hasn't provided credentials, this might fail or warn.

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
import fs from 'fs';
import path from 'path';

if (!admin.apps.length) {
    try {
        let credential;
        // Check if serviceAccountKey.json exists locally if env var not set
        const localKeyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');

        if (fs.existsSync(localKeyPath)) {
            credential = admin.credential.cert(localKeyPath);
        } else {
            credential = admin.credential.applicationDefault();
        }

        admin.initializeApp({ credential });
    } catch (error) {
        console.error("Firebase init failed:", error);
    }
}

export default admin;
