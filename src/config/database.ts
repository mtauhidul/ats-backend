import logger from "../utils/logger";
import { initializeFirebase, getFirestoreDB } from "./firebase";
import { config } from "./index";

/**
 * Connect Database - replaced MongoDB with Firestore initialization.
 * This keeps the same exported function name so other parts of the app
 * can continue calling `connectDatabase()` when starting up.
 */
export async function connectDatabase(): Promise<void> {
  try {
    // Initialize Firebase Admin SDK and Firestore
    initializeFirebase();
    // Verify connection by getting DB instance
    getFirestoreDB();
    logger.info("✅ Firestore initialized and ready");

    // Optionally configure any global timeouts or monitoring here
    if (config.env === 'development' || config.env === 'staging') {
      logger.debug('Firestore running in', config.env, 'mode');
    }
  } catch (error) {
    logger.error("❌ Firestore initialization error:", error);
    process.exit(1);
  }
}

/**
 * closeDatabase - noop for Firestore (Admin SDK manages connections)
 */
export async function closeDatabase(): Promise<void> {
  try {
    // Firestore Admin SDK does not require explicit close in most cases.
    logger.info('Firestore cleanup: no action required');
  } catch (error) {
    logger.warn('Error during Firestore cleanup', error);
  }
}
