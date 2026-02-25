import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Uses GOOGLE_APPLICATION_CREDENTIALS env var automatically
// Set it to the file path of your serviceAccountKey.json
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error(
    "GOOGLE_APPLICATION_CREDENTIALS must be set to the path of your Firebase service account key JSON file."
  );
}

const app = initializeApp({
  credential: applicationDefault(),
});

export const db = getFirestore(app);

// Collection reference for portfolios
export const portfoliosCollection = db.collection('portfolios');
