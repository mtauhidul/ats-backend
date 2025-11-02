import { initializeFirebase, getFirestoreDb } from '../src/config/firebase';

/**
 * Script to reset application status so it can be re-approved
 */
async function resetApplicationStatus() {
  try {
    // Initialize Firebase
    initializeFirebase();
    const db = getFirestoreDb();
    
    // Application ID
    const applicationId = 'QxxcxDHjvLCQmvxF0rY6';
    
    // Update application status back to pending
    await db.collection('applications').doc(applicationId).update({
      status: 'pending',
      approvedAt: null,
      reviewedBy: null,
    });
    
    console.log('✅ Application status reset to "pending"');
    console.log('Now you can approve it again from the UI and the candidate will be created with the video URL');
  } catch (error) {
    console.error('Error:', error);
  }
}

resetApplicationStatus();
