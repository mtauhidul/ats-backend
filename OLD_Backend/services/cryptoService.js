// services/cryptoService.js
// Encryption service for securing sensitive data like email account passwords

const crypto = require('crypto');
const logger = require('../utils/logger');

// Algorithm for encryption - AES-256-GCM (Galois/Counter Mode)
// GCM provides both encryption and authentication
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // Initialization vector length
const AUTH_TAG_LENGTH = 16; // Authentication tag length
const SALT_LENGTH = 64; // Salt length for key derivation

/**
 * Get encryption key from environment variable
 * The key must be exactly 32 bytes (256 bits) for AES-256
 * @returns {Buffer} The encryption key
 */
function getEncryptionKey() {
  const keyString = process.env.EMAIL_ACCOUNT_ENCRYPTION_KEY;
  
  if (!keyString) {
    throw new Error(
      'EMAIL_ACCOUNT_ENCRYPTION_KEY is not set in environment variables. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // If key is hex string (64 characters), convert to buffer
  if (keyString.length === 64) {
    return Buffer.from(keyString, 'hex');
  }
  
  // If key is base64 or other format, hash it to get 32 bytes
  return crypto.createHash('sha256').update(keyString).digest();
}

/**
 * Encrypt sensitive text data
 * @param {string} plainText - The text to encrypt
 * @returns {Object} Encrypted data with IV and auth tag
 */
function encrypt(plainText) {
  try {
    if (!plainText || typeof plainText !== 'string') {
      throw new Error('Plain text must be a non-empty string');
    }

    const key = getEncryptionKey();
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag (provides integrity verification)
    const authTag = cipher.getAuthTag();
    
    // Return all components needed for decryption
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: ALGORITHM
    };
  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt encrypted data
 * @param {Object} encryptedData - The encrypted data object (with encrypted, iv, authTag)
 * @returns {string} The decrypted plain text
 */
function decrypt(encryptedData) {
  try {
    if (!encryptedData || typeof encryptedData !== 'object') {
      throw new Error('Encrypted data must be an object');
    }

    const { encrypted, iv, authTag } = encryptedData;
    
    if (!encrypted || !iv || !authTag) {
      throw new Error('Invalid encrypted data structure');
    }

    const key = getEncryptionKey();
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );
    
    // Set the authentication tag
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash a password using PBKDF2
 * Use this for passwords that need to be verified, not decrypted
 * @param {string} password - The password to hash
 * @param {string} [salt] - Optional salt (will be generated if not provided)
 * @returns {Object} Hash and salt
 */
function hashPassword(password, salt = null) {
  try {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    // Generate salt if not provided
    const saltBuffer = salt 
      ? Buffer.from(salt, 'hex')
      : crypto.randomBytes(SALT_LENGTH);
    
    // Hash the password using PBKDF2 with 100,000 iterations
    const hash = crypto.pbkdf2Sync(
      password,
      saltBuffer,
      100000,
      64,
      'sha512'
    );
    
    return {
      hash: hash.toString('hex'),
      salt: saltBuffer.toString('hex')
    };
  } catch (error) {
    logger.error('Password hashing error:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Verify a password against a hash
 * @param {string} password - The password to verify
 * @param {string} hash - The stored hash
 * @param {string} salt - The stored salt
 * @returns {boolean} True if password matches
 */
function verifyPassword(password, hash, salt) {
  try {
    const { hash: computedHash } = hashPassword(password, salt);
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(computedHash, 'hex')
    );
  } catch (error) {
    logger.error('Password verification error:', error);
    return false;
  }
}

/**
 * Generate a secure random token
 * @param {number} [length=32] - Length of the token in bytes
 * @returns {string} Random token in hex format
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure API key
 * @returns {string} Secure API key
 */
function generateApiKey() {
  return generateToken(32);
}

module.exports = {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  generateToken,
  generateApiKey
};
