// services/fileUploadService.js
// Secure file upload validation and handling

const { fileTypeFromBuffer } = require('file-type');
const sanitize = require('sanitize-filename');
const logger = require('../utils/logger');
const crypto = require('crypto');
const path = require('path');

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (reduced from 10MB)
const MAX_FILENAME_LENGTH = 255;

// Allowed file types with their MIME types and extensions
const ALLOWED_FILE_TYPES = {
  'application/pdf': {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    magicBytes: [
      [0x25, 0x50, 0x44, 0x46], // %PDF
    ]
  },
  'application/msword': {
    extensions: ['.doc'],
    mimeTypes: ['application/msword'],
    magicBytes: [
      [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // DOC
    ]
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['.docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    magicBytes: [
      [0x50, 0x4B, 0x03, 0x04], // DOCX (ZIP format)
      [0x50, 0x4B, 0x05, 0x06], // DOCX (empty ZIP)
      [0x50, 0x4B, 0x07, 0x08], // DOCX (spanned ZIP)
    ]
  },
  'text/plain': {
    extensions: ['.txt'],
    mimeTypes: ['text/plain'],
    magicBytes: [] // Plain text doesn't have specific magic bytes
  },
  // NEW: Video file types
  'video/mp4': {
    extensions: ['.mp4'],
    mimeTypes: ['video/mp4'],
    magicBytes: [
      [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // MP4
      [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], // MP4 variant
    ]
  },
  'video/quicktime': {
    extensions: ['.mov'],
    mimeTypes: ['video/quicktime'],
    magicBytes: [
      [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70], // MOV
    ]
  },
  'video/webm': {
    extensions: ['.webm'],
    mimeTypes: ['video/webm'],
    magicBytes: [
      [0x1A, 0x45, 0xDF, 0xA3], // WebM
    ]
  }
};

/**
 * Validate file size
 * @param {number} fileSize - File size in bytes
 * @param {number} [maxSize] - Maximum allowed size (optional)
 * @returns {Object} Validation result
 */
function validateFileSize(fileSize, maxSize = MAX_FILE_SIZE) {
  if (!fileSize || fileSize === 0) {
    return {
      valid: false,
      error: 'File is empty',
      details: { size: fileSize }
    };
  }

  if (fileSize > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB`,
      details: {
        size: fileSize,
        maxSize,
        sizeMB: (fileSize / 1024 / 1024).toFixed(2),
        maxSizeMB: (maxSize / 1024 / 1024).toFixed(2)
      }
    };
  }

  return {
    valid: true,
    size: fileSize,
    sizeMB: (fileSize / 1024 / 1024).toFixed(2)
  };
}

/**
 * Sanitize and validate filename
 * @param {string} filename - Original filename
 * @returns {Object} Sanitized filename and validation result
 */
function validateAndSanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return {
      valid: false,
      error: 'Invalid filename',
      sanitized: 'untitled'
    };
  }

  // Remove any path traversal attempts
  const baseName = path.basename(filename);
  
  // Sanitize filename (removes special characters, null bytes, etc.)
  let sanitized = sanitize(baseName, { replacement: '_' });
  
  // Additional sanitization
  sanitized = sanitized
    .replace(/[<>:"|?*\x00-\x1f]/g, '_') // Remove dangerous characters
    .replace(/^\.+/, '') // Remove leading dots
    .replace(/\.+$/, '') // Remove trailing dots
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .trim();

  // Check filename length
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    const ext = path.extname(sanitized);
    const nameWithoutExt = sanitized.slice(0, sanitized.length - ext.length);
    sanitized = nameWithoutExt.slice(0, MAX_FILENAME_LENGTH - ext.length - 10) + ext;
  }

  // Ensure filename is not empty after sanitization
  if (!sanitized || sanitized === '' || sanitized === '.') {
    sanitized = `file_${Date.now()}`;
  }

  // Add extension if missing
  if (!path.extname(sanitized)) {
    const originalExt = path.extname(baseName);
    if (originalExt) {
      sanitized += originalExt;
    }
  }

  return {
    valid: true,
    original: filename,
    sanitized: sanitized,
    changed: filename !== sanitized
  };
}

/**
 * Validate file type using magic bytes (file signature)
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} declaredMimeType - MIME type from upload
 * @param {string} filename - Original filename
 * @returns {Promise<Object>} Validation result
 */
async function validateFileType(fileBuffer, declaredMimeType, filename) {
  try {
    // Get file type from magic bytes
    const detectedType = await fileTypeFromBuffer(fileBuffer);
    
    // Check if file type was detected
    if (!detectedType && declaredMimeType !== 'text/plain') {
      return {
        valid: false,
        error: 'Could not determine file type from content',
        details: {
          declared: declaredMimeType,
          detected: null
        }
      };
    }

    // For text files, we can't reliably detect from magic bytes
    if (declaredMimeType === 'text/plain') {
      const ext = path.extname(filename).toLowerCase();
      if (ext !== '.txt') {
        return {
          valid: false,
          error: 'Text file must have .txt extension',
          details: { extension: ext }
        };
      }
      
      return {
        valid: true,
        mimeType: 'text/plain',
        extension: '.txt',
        verified: 'by-extension'
      };
    }

    // Check if detected type is in allowed list
    const allowedType = ALLOWED_FILE_TYPES[detectedType.mime];
    if (!allowedType) {
      return {
        valid: false,
        error: `File type '${detectedType.mime}' is not allowed`,
        details: {
          detected: detectedType.mime,
          allowed: Object.keys(ALLOWED_FILE_TYPES)
        }
      };
    }

    // Verify that declared MIME type matches detected type (or is in same family)
    const detectedMime = detectedType.mime;
    const declaredNormalized = declaredMimeType.toLowerCase();
    
    // For DOCX files, the magic bytes show as ZIP, so we need special handling
    if (declaredNormalized.includes('wordprocessingml') && detectedMime === 'application/zip') {
      // DOCX files are ZIP archives, this is expected
      return {
        valid: true,
        mimeType: declaredMimeType,
        extension: detectedType.ext,
        verified: 'magic-bytes',
        note: 'DOCX detected as ZIP (expected)'
      };
    }

    // Check if MIME types match
    if (detectedMime !== declaredNormalized && !allowedType.mimeTypes.includes(declaredNormalized)) {
      return {
        valid: false,
        error: 'Declared file type does not match actual file content',
        details: {
          declared: declaredMimeType,
          detected: detectedMime
        }
      };
    }

    return {
      valid: true,
      mimeType: detectedType.mime,
      extension: detectedType.ext,
      verified: 'magic-bytes'
    };
  } catch (error) {
    logger.error('File type validation error:', error);
    return {
      valid: false,
      error: 'Failed to validate file type',
      details: { message: error.message }
    };
  }
}

/**
 * Check file extension against allowed list
 * @param {string} filename - Filename
 * @returns {Object} Validation result
 */
function validateFileExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  if (!ext) {
    return {
      valid: false,
      error: 'File has no extension'
    };
  }

  // Check if extension is in allowed list
  const allowedExtensions = Object.values(ALLOWED_FILE_TYPES)
    .flatMap(type => type.extensions);

  if (!allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `File extension '${ext}' is not allowed`,
      details: {
        extension: ext,
        allowed: allowedExtensions
      }
    };
  }

  return {
    valid: true,
    extension: ext
  };
}

/**
 * Generate secure filename for storage
 * @param {string} originalFilename - Original filename
 * @returns {string} Secure filename with timestamp and random hash
 */
function generateSecureFilename(originalFilename) {
  const sanitizedResult = validateAndSanitizeFilename(originalFilename);
  const sanitized = sanitizedResult.sanitized;
  
  const ext = path.extname(sanitized);
  const nameWithoutExt = path.basename(sanitized, ext);
  
  // Generate random hash
  const hash = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();
  
  // Create secure filename: timestamp_hash_originalname.ext
  return `${timestamp}_${hash}_${nameWithoutExt}${ext}`;
}

/**
 * Comprehensive file validation
 * @param {Object} file - Multer file object
 * @param {Object} [options] - Validation options
 * @returns {Promise<Object>} Validation result
 */
async function validateFile(file, options = {}) {
  const validationResults = {
    valid: true,
    errors: [],
    warnings: [],
    details: {}
  };

  try {
    // 1. Validate file exists
    if (!file || !file.buffer) {
      validationResults.valid = false;
      validationResults.errors.push('No file provided');
      return validationResults;
    }

    // 2. Validate file size
    const sizeValidation = validateFileSize(
      file.size,
      options.maxSize || MAX_FILE_SIZE
    );
    
    if (!sizeValidation.valid) {
      validationResults.valid = false;
      validationResults.errors.push(sizeValidation.error);
      validationResults.details.size = sizeValidation.details;
      return validationResults;
    }
    
    validationResults.details.size = sizeValidation;

    // 3. Validate and sanitize filename
    const filenameValidation = validateAndSanitizeFilename(file.originalname);
    
    if (!filenameValidation.valid) {
      validationResults.valid = false;
      validationResults.errors.push(filenameValidation.error);
    }
    
    if (filenameValidation.changed) {
      validationResults.warnings.push(
        `Filename was sanitized from '${filenameValidation.original}' to '${filenameValidation.sanitized}'`
      );
    }
    
    validationResults.details.filename = filenameValidation;

    // 4. Validate file extension
    const extensionValidation = validateFileExtension(filenameValidation.sanitized);
    
    if (!extensionValidation.valid) {
      validationResults.valid = false;
      validationResults.errors.push(extensionValidation.error);
      if (extensionValidation.details) {
        validationResults.details.extension = extensionValidation.details;
      }
      return validationResults;
    }
    
    validationResults.details.extension = extensionValidation;

    // 5. Validate file type using magic bytes
    const typeValidation = await validateFileType(
      file.buffer,
      file.mimetype,
      filenameValidation.sanitized
    );
    
    if (!typeValidation.valid) {
      validationResults.valid = false;
      validationResults.errors.push(typeValidation.error);
      validationResults.details.type = typeValidation.details || typeValidation;
      return validationResults;
    }
    
    if (typeValidation.note) {
      validationResults.warnings.push(typeValidation.note);
    }
    
    validationResults.details.type = typeValidation;

    // 6. Generate secure storage filename
    const secureFilename = generateSecureFilename(filenameValidation.sanitized);
    validationResults.details.secureFilename = secureFilename;

    // Success
    validationResults.valid = true;
    validationResults.sanitizedFilename = filenameValidation.sanitized;
    validationResults.secureFilename = secureFilename;
    
    logger.info('File validation successful', {
      original: file.originalname,
      sanitized: filenameValidation.sanitized,
      secure: secureFilename,
      size: sizeValidation.sizeMB + 'MB',
      type: typeValidation.mimeType
    });

    return validationResults;
  } catch (error) {
    logger.error('File validation error:', error);
    validationResults.valid = false;
    validationResults.errors.push('File validation failed: ' + error.message);
    return validationResults;
  }
}

/**
 * Get file upload configuration for multer
 * @returns {Object} Multer configuration
 */
function getUploadConfig() {
  return {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 1, // Only one file at a time
      fields: 10 // Maximum number of non-file fields
    },
    fileFilter: (req, file, cb) => {
      // Basic pre-validation (fast check before upload)
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
      
      if (!allowedExtensions.includes(ext)) {
        cb(new Error(`File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`));
        return;
      }
      
      cb(null, true);
    }
  };
}

module.exports = {
  validateFile,
  validateFileSize,
  validateFileType,
  validateFileExtension,
  validateAndSanitizeFilename,
  generateSecureFilename,
  getUploadConfig,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES
};
