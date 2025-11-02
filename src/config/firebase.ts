import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import logger from '../utils/logger';
import { config } from './index';

let app: App;
let db: Firestore;

/**
 * Initialize Firebase Admin SDK
 * Singleton pattern to ensure single instance
 */
export function initializeFirebase(): void {
  try {
    // Check if Firebase is already initialized
    if (getApps().length > 0) {
      logger.info('✅ Firebase already initialized');
      app = getApps()[0];
      db = getFirestore(app);
      return;
    }

    // Initialize with service account from environment
    if (config.firebase.serviceAccountPath) {
      // Production: Use service account file
      app = initializeApp({
        credential: cert(config.firebase.serviceAccountPath),
        projectId: config.firebase.projectId,
      });
    } else if (config.firebase.serviceAccountJson) {
      // Alternative: Use service account JSON from environment variable
      const serviceAccount = JSON.parse(config.firebase.serviceAccountJson);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: config.firebase.projectId,
      });
    } else {
      // Development: Use application default credentials
      app = initializeApp({
        projectId: config.firebase.projectId,
      });
    }

    // Initialize Firestore
    db = getFirestore(app);

    // Configure Firestore settings
    db.settings({
      ignoreUndefinedProperties: true, // Ignore undefined values
      // timestampsInSnapshots: true, // Use Timestamp objects (default in v9+)
    });

    logger.info('✅ Firebase Admin SDK initialized successfully');
    logger.info(`📊 Firestore connected to project: ${config.firebase.projectId}`);
  } catch (error) {
    logger.error('❌ Firebase initialization error:', error);
    throw error;
  }
}

/**
 * Get Firestore database instance
 */
export function getFirestoreDB(): Firestore {
  if (!db) {
    initializeFirebase();
  }
  return db;
}

/**
 * Get Firebase Auth instance
 */
export function getFirebaseAuth() {
  if (!app) {
    initializeFirebase();
  }
  return getAuth(app);
}

/**
 * Get Firestore instance
 */
export function getFirestoreDb() {
  if (!db) {
    initializeFirebase();
  }
  return db;
}

// No cleanup needed - Firebase handles it automatically
