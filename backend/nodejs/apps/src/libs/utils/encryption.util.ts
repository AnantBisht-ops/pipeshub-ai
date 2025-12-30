/**
 * Encryption Utilities
 *
 * Provides AES-256-GCM encryption/decryption for sensitive data like API keys.
 * Uses Node.js crypto module for secure operations.
 */

import crypto from 'crypto';
import {
  DecryptionError,
  EncryptionKeyError,
  InvalidInputError,
} from '../errors/encryption.errors';

/**
 * Encryption configuration
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  /** Encrypted data (base64) */
  encryptedData: string;
  /** Initialization vector (base64) */
  iv: string;
  /** Authentication tag (base64) */
  tag: string;
}

/**
 * Derive a proper encryption key from a secret
 *
 * Ensures the key is exactly 32 bytes for AES-256
 *
 * @param secret - The secret string to derive key from
 * @returns 32-byte buffer key
 */
const deriveKey = (secret: string): Buffer => {
  if (!secret || secret.length === 0) {
    throw new EncryptionKeyError('Encryption key cannot be empty');
  }

  // Use SHA-256 to derive a consistent 32-byte key
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypt a string using AES-256-GCM
 *
 * @param plaintext - The string to encrypt
 * @param encryptionKey - The encryption key/secret
 * @returns Encrypted data object with encrypted data, IV, and auth tag
 *
 * @example
 * const encrypted = encrypt('my-api-key', 'my-secret');
 * // Returns: { encryptedData: '...', iv: '...', tag: '...' }
 */
export const encrypt = (
  plaintext: string,
  encryptionKey: string,
): EncryptedData => {
  if (!plaintext) {
    throw new InvalidInputError('Plaintext cannot be empty');
  }

  if (!encryptionKey) {
    throw new EncryptionKeyError('Encryption key is required');
  }

  try {
    // Derive proper key from secret
    const key = deriveKey(encryptionKey);

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get auth tag
    const tag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  } catch (error) {
    if (
      error instanceof InvalidInputError ||
      error instanceof EncryptionKeyError
    ) {
      throw error;
    }
    throw new EncryptionKeyError(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

/**
 * Decrypt data using AES-256-GCM
 *
 * @param encryptedData - The encrypted data object
 * @param encryptionKey - The encryption key/secret
 * @returns Decrypted plaintext string
 *
 * @example
 * const decrypted = decrypt(encryptedData, 'my-secret');
 * // Returns: 'my-api-key'
 */
export const decrypt = (
  encryptedData: EncryptedData,
  encryptionKey: string,
): string => {
  if (!encryptedData || !encryptedData.encryptedData) {
    throw new InvalidInputError('Encrypted data is required');
  }

  if (!encryptedData.iv) {
    throw new InvalidInputError('IV is required for decryption');
  }

  if (!encryptedData.tag) {
    throw new InvalidInputError('Authentication tag is required');
  }

  if (!encryptionKey) {
    throw new EncryptionKeyError('Encryption key is required');
  }

  try {
    // Derive proper key from secret
    const key = deriveKey(encryptionKey);

    // Convert from base64
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Set auth tag
    decipher.setAuthTag(tag);

    // Decrypt data
    let decrypted = decipher.update(encryptedData.encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    if (
      error instanceof InvalidInputError ||
      error instanceof EncryptionKeyError
    ) {
      throw error;
    }

    // Check for authentication failure
    if (error instanceof Error && error.message.includes('auth')) {
      throw new DecryptionError(
        'Authentication failed - data may have been tampered with',
      );
    }

    throw new DecryptionError(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

/**
 * Encrypt a string and return as a single combined string
 *
 * Combines encrypted data, IV, and tag into a single string for storage.
 * Format: base64(iv):base64(tag):base64(encrypted)
 *
 * @param plaintext - The string to encrypt
 * @param encryptionKey - The encryption key/secret
 * @returns Combined encrypted string
 */
export const encryptToString = (
  plaintext: string,
  encryptionKey: string,
): string => {
  const encrypted = encrypt(plaintext, encryptionKey);
  return `${encrypted.iv}:${encrypted.tag}:${encrypted.encryptedData}`;
};

/**
 * Decrypt a combined encrypted string
 *
 * @param combinedString - The combined encrypted string (format: iv:tag:data)
 * @param encryptionKey - The encryption key/secret
 * @returns Decrypted plaintext string
 */
export const decryptFromString = (
  combinedString: string,
  encryptionKey: string,
): string => {
  if (!combinedString || !combinedString.includes(':')) {
    throw new InvalidInputError('Invalid encrypted string format');
  }

  const parts = combinedString.split(':');
  if (parts.length !== 3) {
    throw new InvalidInputError(
      'Invalid encrypted string format - expected iv:tag:data',
    );
  }

  const iv = parts[0]!;
  const tag = parts[1]!;
  const encryptedData = parts[2]!;

  return decrypt(
    {
      iv,
      tag,
      encryptedData,
    },
    encryptionKey,
  );
};

/**
 * Check if a string is a valid encrypted string format
 *
 * @param value - The string to check
 * @returns Boolean indicating if the string appears to be encrypted
 */
export const isEncryptedString = (value: string): boolean => {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const parts = value.split(':');
  if (parts.length !== 3) {
    return false;
  }

  // Check if each part is valid base64
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  return parts.every((part) => base64Regex.test(part) && part.length > 0);
};
