import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Option 1: Using a service account JSON key (recommended for server-side)
// Set FIREBASE_SERVICE_ACCOUNT env var to the JSON string of your service account key
// OR set GOOGLE_APPLICATION_CREDENTIALS env var to the file path of your service account key

let firebaseConfig: { credential?: ReturnType<typeof cert> } = {};

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
  firebaseConfig = { credential: cert(serviceAccount) };
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // Firebase Admin SDK auto-detects this env var
  firebaseConfig = {};
} else {
  throw new Error(
    "Firebase credentials not configured. Set either FIREBASE_SERVICE_ACCOUNT (JSON string) " +
    "or GOOGLE_APPLICATION_CREDENTIALS (file path to service account key)."
  );
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Collection reference for portfolios
export const portfoliosCollection = db.collection('portfolios');
