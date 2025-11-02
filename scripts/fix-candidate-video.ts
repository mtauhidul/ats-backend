import { initializeFirebase, getFirestoreDb } from '../src/config/firebase';

/**
 * Script to copy video URL from application to candidate
 * Run this once to fix existing candidates that were approved before the video copy fix
 */
async function fixCandidateVideo() {
  try {
    // Initialize Firebase
    initializeFirebase();
    const db = getFirestoreDb();
    
    // Application ID from your data
    const applicationId = 'QxxcxDHjvLCQmvxF0rY6';
    
    // Get the application
    const applicationDoc = await db.collection('applications').doc(applicationId).get();
    
    if (!applicationDoc.exists) {
      console.log('Application not found');
      return;
    }
    
    const application = applicationDoc.data();
    console.log('Application found:', application?.email);
    console.log('Video URL:', application?.videoIntroUrl);
    
    // Find candidate with this applicationId or by email
    let candidatesSnapshot = await db.collection('candidates')
      .where('applicationIds', 'array-contains', applicationId)
      .get();
    
    if (candidatesSnapshot.empty) {
      console.log('No candidate found by applicationId, trying email...');
      candidatesSnapshot = await db.collection('candidates')
        .where('email', '==', application?.email)
        .get();
    }
    
    if (candidatesSnapshot.empty) {
      console.log('❌ No candidate found for this application');
      return;
    }
    
    // Update the candidate with video URL
    for (const candidateDoc of candidatesSnapshot.docs) {
      const candidateId = candidateDoc.id;
      const candidate = candidateDoc.data();
      
      console.log('\nUpdating candidate:', candidate.email);
      console.log('Candidate ID:', candidateId);
      
      const updateData: any = {};
      
      if (application?.videoIntroUrl) {
        updateData.videoIntroUrl = application.videoIntroUrl;
        console.log('Adding videoIntroUrl');
      }
      if (application?.videoIntroFilename) {
        updateData.videoIntroFilename = application.videoIntroFilename;
        console.log('Adding videoIntroFilename');
      }
      if (application?.videoIntroDuration) {
        updateData.videoIntroDuration = application.videoIntroDuration;
        console.log('Adding videoIntroDuration');
      }
      if (application?.videoIntroFileSize) {
        updateData.videoIntroFileSize = application.videoIntroFileSize;
        console.log('Adding videoIntroFileSize');
      }
      
      if (Object.keys(updateData).length > 0) {
        await db.collection('candidates').doc(candidateId).update(updateData);
        console.log('✅ Candidate updated successfully');
      } else {
        console.log('⚠️  No video fields to update');
      }
    }
    
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

fixCandidateVideo();
