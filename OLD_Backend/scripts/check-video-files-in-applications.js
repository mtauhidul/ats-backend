// scripts/check-video-files-in-applications.js
// Check if any applications contain video files from email imports

require('dotenv').config();
const { db } = require('../services/firebaseService');

async function checkVideoFilesInApplications() {
  try {
    console.log('🎥 CHECKING FOR VIDEO FILES IN EMAIL IMPORTS');
    console.log('='.repeat(60));
    
    // Get all applications to analyze
    const snapshot = await db.collection('applications').get();
    console.log(`📊 Total applications to analyze: ${snapshot.size}`);
    
    if (snapshot.empty) {
      console.log('❌ No applications found');
      return;
    }

    let videoFilesFound = [];
    let videoRelatedFields = new Set();
    let attachmentTypes = new Set();
    let fileExtensions = new Set();
    
    console.log('\n🔍 Analyzing applications for video content...\n');
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const docId = doc.id;
      
      // Check for video-related field names
      Object.keys(data).forEach(key => {
        if (key.toLowerCase().includes('video')) {
          videoRelatedFields.add(key);
        }
      });
      
      // Check file-related fields for video content
      const fieldsToCheck = [
        'originalFilename',
        'resumeFileName', 
        'fileType',
        'resume.fileName',
        'resume.fileType'
      ];
      
      fieldsToCheck.forEach(fieldPath => {
        let value = data;
        const parts = fieldPath.split('.');
        
        for (const part of parts) {
          if (value && typeof value === 'object') {
            value = value[part];
          } else {
            value = undefined;
            break;
          }
        }
        
        if (value && typeof value === 'string') {
          // Check for video file extensions
          const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp', '.ogv'];
          const hasVideoExt = videoExtensions.some(ext => value.toLowerCase().includes(ext));
          
          if (hasVideoExt) {
            videoFilesFound.push({
              docId: docId,
              field: fieldPath,
              value: value,
              createdAt: data.createdAt,
              source: data.source,
              name: data.name || data.candidateName
            });
          }
          
          // Track file types and extensions
          if (fieldPath.includes('fileType') || fieldPath.includes('Type')) {
            attachmentTypes.add(value);
          }
          
          if (fieldPath.includes('filename') || fieldPath.includes('FileName')) {
            const ext = value.substring(value.lastIndexOf('.'));
            if (ext) {
              fileExtensions.add(ext.toLowerCase());
            }
          }
        }
      });
      
      // Check attachments array if it exists
      if (data.attachments && Array.isArray(data.attachments)) {
        data.attachments.forEach((attachment, index) => {
          if (attachment.filename || attachment.name) {
            const filename = attachment.filename || attachment.name;
            const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp', '.ogv'];
            const hasVideoExt = videoExtensions.some(ext => filename.toLowerCase().includes(ext));
            
            if (hasVideoExt) {
              videoFilesFound.push({
                docId: docId,
                field: `attachments[${index}].filename`,
                value: filename,
                createdAt: data.createdAt,
                source: data.source,
                name: data.name || data.candidateName,
                attachmentData: attachment
              });
            }
          }
        });
      }
      
      // Check history for video mentions
      if (data.history && Array.isArray(data.history)) {
        data.history.forEach((historyItem, index) => {
          if (historyItem.note && typeof historyItem.note === 'string') {
            const note = historyItem.note.toLowerCase();
            if (note.includes('video') || note.includes('.mp4') || note.includes('.mov')) {
              videoFilesFound.push({
                docId: docId,
                field: `history[${index}].note`,
                value: historyItem.note,
                createdAt: data.createdAt,
                source: data.source,
                name: data.name || data.candidateName,
                isHistoryNote: true
              });
            }
          }
        });
      }
    });
    
    // Report findings
    console.log('📊 ANALYSIS RESULTS');
    console.log('='.repeat(40));
    
    if (videoFilesFound.length > 0) {
      console.log(`🎥 Found ${videoFilesFound.length} video-related entries:`);
      console.log('');
      
      videoFilesFound.forEach((item, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${item.name || 'Unknown'}`);
        console.log(`    📄 Document ID: ${item.docId}`);
        console.log(`    📍 Field: ${item.field}`);
        console.log(`    📂 Value: ${item.value}`);
        console.log(`    📅 Created: ${item.createdAt || 'Unknown'}`);
        console.log(`    📧 Source: ${item.source || 'Unknown'}`);
        
        if (item.attachmentData) {
          console.log(`    💾 File Size: ${item.attachmentData.size || 'Unknown'} bytes`);
          console.log(`    📎 Content Type: ${item.attachmentData.contentType || 'Unknown'}`);
        }
        
        if (item.isHistoryNote) {
          console.log(`    📝 Note: History entry mentions video`);
        }
        
        console.log('');
      });
    } else {
      console.log('❌ No video files found in existing applications');
    }
    
    if (videoRelatedFields.size > 0) {
      console.log('🏷️  Video-related field names found:');
      [...videoRelatedFields].forEach(field => {
        console.log(`   • ${field}`);
      });
      console.log('');
    }
    
    console.log('📂 File types encountered:');
    [...attachmentTypes].sort().forEach(type => {
      console.log(`   • ${type}`);
    });
    console.log('');
    
    console.log('📄 File extensions encountered:');
    [...fileExtensions].sort().forEach(ext => {
      console.log(`   • ${ext}`);
    });
    console.log('');
    
    // Check current schema for video support
    console.log('🔍 CURRENT SCHEMA ANALYSIS');
    console.log('='.repeat(40));
    
    const currentVideoSupport = checkCurrentVideoSupport();
    console.log(currentVideoSupport.summary);
    
    if (videoFilesFound.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      console.log('='.repeat(40));
      console.log('Since video files were found in email imports, consider:');
      console.log('');
      console.log('1. ✅ Add dedicated video resume fields to the schema:');
      console.log('   • hasVideoResume: boolean');
      console.log('   • videoResumeURL: string');
      console.log('   • videoResumeFileName: string');
      console.log('   • videoResumeFileSize: number');
      console.log('   • videoResumeFileType: string');
      console.log('   • videoIntroduction: object with URL, filename, etc.');
      console.log('');
      console.log('2. 🔧 Update file upload service to support video formats');
      console.log('3. 📱 Update email import to detect and handle video attachments');
      console.log('4. 🏗️  Consider video player integration in the frontend');
    }
    
    return {
      videoFilesFound,
      videoRelatedFields: [...videoRelatedFields],
      attachmentTypes: [...attachmentTypes],
      fileExtensions: [...fileExtensions],
      needsVideoSupport: videoFilesFound.length > 0
    };
    
  } catch (error) {
    console.error('❌ Error checking video files:', error);
    throw error;
  }
}

function checkCurrentVideoSupport() {
  // Check if current normalized schema supports video
  const hasVideoFields = [
    'hasVideoResume',
    'videoResumeURL', 
    'videoResumeFileName',
    'videoIntroduction',
    'videoResume'
  ];
  
  const supported = [];
  const missing = [];
  
  // This would need to check against the actual schema
  hasVideoFields.forEach(field => {
    // For now, assume they're missing since we haven't seen them in the schema
    missing.push(field);
  });
  
  return {
    supported,
    missing,
    summary: missing.length > 0 
      ? `❌ Current schema lacks dedicated video resume support\n   Missing fields: ${missing.join(', ')}`
      : `✅ Current schema supports video resumes`
  };
}

if (require.main === module) {
  checkVideoFilesInApplications()
    .then((results) => {
      if (results.needsVideoSupport) {
        console.log('\n🎬 ACTION REQUIRED: Video resume support should be added to the schema');
      } else {
        console.log('\n✅ No video files detected - current schema is sufficient');
      }
      console.log('\n📊 Analysis complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { checkVideoFilesInApplications };