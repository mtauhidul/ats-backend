import logger from './logger';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Video Attachment Handler
 * Based on OLD backend's video handling with categorization
 */

// Supported video extensions
const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.wmv',
  '.flv',
  '.webm',
  '.mkv',
  '.m4v',
  '.3gp',
  '.ogv',
  '.mpeg',
  '.mpg'
];

/**
 * Check if a filename is a video file
 */
export function isVideoFile(filename: string): boolean {
  if (!filename) return false;
  const lowerFilename = filename.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lowerFilename.endsWith(ext));
}

/**
 * Get MIME type for video file based on extension
 */
export function getVideoMimeType(filename: string): string {
  if (!filename) return '';
  
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  const mimeTypes: { [key: string]: string } = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.m4v': 'video/mp4',
    '.3gp': 'video/3gpp',
    '.ogv': 'video/ogg',
    '.mpeg': 'video/mpeg',
    '.mpg': 'video/mpeg'
  };
  
  return mimeTypes[ext] || 'video/mp4';
}

/**
 * Categorize video file as introduction or resume based on filename
 * Returns 'introduction' for video introductions or 'resume' for video resumes
 */
export function categorizeVideoFile(filename: string): 'introduction' | 'resume' {
  if (!filename) return 'resume';
  
  const name = filename.toLowerCase();
  
  // Check for video introduction keywords
  const introKeywords = [
    'intro',
    'introduction',
    'hello',
    'greet',
    'greeting',
    'about',
    'myself',
    'me',
    'pitch'
  ];
  
  if (introKeywords.some(keyword => name.includes(keyword))) {
    return 'introduction';
  }
  
  // Check for recording platform keywords (usually introductions)
  const platformKeywords = ['loom', 'zoom', 'recording', 'record'];
  
  if (platformKeywords.some(keyword => name.includes(keyword))) {
    return 'introduction';
  }
  
  // Default to resume if unclear
  return 'resume';
}

/**
 * Upload video to Cloudinary
 * Videos are uploaded to the 'videos' folder with appropriate resource type
 */
export async function uploadVideoToCloudinary(
  buffer: Buffer,
  filename: string
): Promise<{ url: string; publicId: string }> {
  try {
    logger.info(`📹 Uploading video to Cloudinary: ${filename} (${buffer.length} bytes)`);
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'ats/videos',
          public_id: `video_${Date.now()}_${filename.replace(/[^a-zA-Z0-9]/g, '_')}`,
          overwrite: true,
          // Video-specific options
          eager: [
            { streaming_profile: 'full_hd', format: 'm3u8' } // Generate HLS for streaming
          ],
          eager_async: true // Process transformations asynchronously
        },
        (error, result) => {
          if (error) {
            logger.error(`❌ Video upload failed:`, error);
            reject(error);
          } else if (result) {
            logger.info(`✅ Video uploaded successfully: ${result.secure_url}`);
            resolve({
              url: result.secure_url,
              publicId: result.public_id
            });
          } else {
            reject(new Error('Upload result is undefined'));
          }
        }
      );
      
      uploadStream.end(buffer);
    });
  } catch (error: any) {
    logger.error(`❌ Error uploading video:`, error);
    throw error;
  }
}

/**
 * Validate video file size
 * Maximum video size: 100MB (configurable)
 */
export function validateVideoSize(buffer: Buffer, maxSizeMB: number = 100): {
  valid: boolean;
  error?: string;
  sizeMB: number;
} {
  const sizeMB = buffer.length / (1024 * 1024);
  
  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `Video size (${sizeMB.toFixed(2)}MB) exceeds maximum allowed size (${maxSizeMB}MB)`,
      sizeMB: parseFloat(sizeMB.toFixed(2))
    };
  }
  
  return {
    valid: true,
    sizeMB: parseFloat(sizeMB.toFixed(2))
  };
}

/**
 * Extract video attachments from email attachments
 * Returns array of video attachments with metadata
 */
export function extractVideoAttachments(attachments: any[]): Array<{
  attachment: any;
  category: 'introduction' | 'resume';
  mimeType: string;
  sizeMB: number;
}> {
  if (!attachments || attachments.length === 0) {
    return [];
  }
  
  return attachments
    .filter(attachment => isVideoFile(attachment.filename))
    .map(attachment => {
      const category = categorizeVideoFile(attachment.filename);
      const mimeType = getVideoMimeType(attachment.filename);
      const sizeMB = attachment.content.length / (1024 * 1024);
      
      return {
        attachment,
        category,
        mimeType,
        sizeMB: parseFloat(sizeMB.toFixed(2))
      };
    });
}

export default {
  isVideoFile,
  getVideoMimeType,
  categorizeVideoFile,
  uploadVideoToCloudinary,
  validateVideoSize,
  extractVideoAttachments
};
