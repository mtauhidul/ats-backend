import crypto from 'crypto';
import { config } from '../config';

/**
 * Encrypt sensitive data (e.g., email passwords)
 */
export function encrypt(text: string): string {
  if (!config.encryption.key || !config.encryption.iv) {
    throw new Error('Encryption key and IV must be set in environment variables');
  }

  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(config.encryption.key, 'hex'),
    Buffer.from(config.encryption.iv, 'hex')
  );

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return encrypted;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText: string): string {
  if (!config.encryption.key || !config.encryption.iv) {
    throw new Error('Encryption key and IV must be set in environment variables');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(config.encryption.key, 'hex'),
    Buffer.from(config.encryption.iv, 'hex')
  );

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate encryption key and IV for .env
 */
export function generateEncryptionKeys(): { key: string; iv: string } {
  const key = crypto.randomBytes(32).toString('hex'); // 256 bits
  const iv = crypto.randomBytes(16).toString('hex');  // 128 bits

  return { key, iv };
}

/**
 * Hash password using bcrypt
 */
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
