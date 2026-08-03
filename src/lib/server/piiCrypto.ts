import 'server-only';
import crypto from 'crypto';

export type ProfilePiiField = 'phone' | 'address';

export interface ProfilePiiContext {
  profileId: string;
  field: ProfilePiiField;
}

export type PiiCryptoErrorCode =
  | 'PII_CONFIG_MISSING'
  | 'PII_KEY_INVALID'
  | 'PII_INPUT_INVALID'
  | 'PII_FORMAT_INVALID'
  | 'PII_VERSION_UNSUPPORTED'
  | 'PII_DECRYPT_FAILED';

export class PiiCryptoError extends Error {
  constructor(public code: PiiCryptoErrorCode) {
    super(`[PiiCryptoError] ${code}`);
    this.name = 'PiiCryptoError';
  }
}

// ---------------------------------------------------------
// Helper functions
// ---------------------------------------------------------

function getActiveVersion(): string {
  const version = process.env.PII_ENCRYPTION_ACTIVE_VERSION;
  if (version !== '1') {
    throw new PiiCryptoError('PII_CONFIG_MISSING');
  }
  return version;
}

function decodeStrictBase64url(
  value: string,
  expectedLength: number | 'min-1',
  errorOnFail: PiiCryptoErrorCode
): Buffer {
  if (!value || typeof value !== 'string') {
    throw new PiiCryptoError(errorOnFail);
  }

  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new PiiCryptoError(errorOnFail);
  }

  const buffer = Buffer.from(value, 'base64url');
  if (buffer.toString('base64url') !== value) {
    throw new PiiCryptoError(errorOnFail);
  }

  if (expectedLength === 'min-1') {
    if (buffer.length < 1) {
      throw new PiiCryptoError(errorOnFail);
    }
  } else {
    if (buffer.length !== expectedLength) {
      throw new PiiCryptoError(errorOnFail);
    }
  }

  return buffer;
}

function getKey(version: string): Buffer {
  let keyStr = '';
  if (version === '1') {
    keyStr = process.env.PII_ENCRYPTION_KEY_V1 || '';
  } else {
    throw new PiiCryptoError('PII_VERSION_UNSUPPORTED');
  }

  if (!keyStr) {
    throw new PiiCryptoError('PII_CONFIG_MISSING');
  }

  return decodeStrictBase64url(keyStr, 32, 'PII_KEY_INVALID');
}

function getAAD(context: ProfilePiiContext, version: string): Buffer {
  return Buffer.from(`profiles:${context.field}:${context.profileId}:v${version}`, 'utf8');
}

function isProfilePiiField(value: unknown): value is ProfilePiiField {
  return value === 'phone' || value === 'address';
}

function validateContext(context: unknown): asserts context is ProfilePiiContext {
  if (!context || typeof context !== 'object') {
    throw new PiiCryptoError('PII_INPUT_INVALID');
  }
  const ctx = context as ProfilePiiContext;
  if (typeof ctx.profileId !== 'string' || ctx.profileId.trim() === '') {
    throw new PiiCryptoError('PII_INPUT_INVALID');
  }
  if (!isProfilePiiField(ctx.field)) {
    throw new PiiCryptoError('PII_INPUT_INVALID');
  }
}

// ---------------------------------------------------------
// Public API
// ---------------------------------------------------------

/**
 * Checks if the string matches the expected encryption format.
 * Note: This only checks the structure, not the cryptographic integrity.
 */
export function isEncryptedPii(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const parts = value.split(':');
  if (parts.length !== 5) return false;
  if (parts[0] !== 'enc') return false;
  if (parts[1] !== 'v1') return false;

  const b64urlRegex = /^[A-Za-z0-9_-]+$/;
  if (!parts[2] || !b64urlRegex.test(parts[2])) return false;
  if (!parts[3] || !b64urlRegex.test(parts[3])) return false;
  if (!parts[4] || !b64urlRegex.test(parts[4])) return false;

  return true;
}

export function encryptProfilePii(
  plaintext: string,
  context: ProfilePiiContext
): string {
  if (typeof plaintext !== 'string' || plaintext.trim() === '') {
    throw new PiiCryptoError('PII_INPUT_INVALID');
  }
  
  validateContext(context);

  const version = getActiveVersion();
  const key = getKey(version);
  const aad = getAAD(context, version);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
    authTagLength: 16,
  });
  
  cipher.setAAD(aad);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return `enc:v${version}:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptProfilePii(
  encryptedValue: string,
  context: ProfilePiiContext
): string {
  if (typeof encryptedValue !== 'string' || encryptedValue.trim() === '') {
    throw new PiiCryptoError('PII_INPUT_INVALID');
  }
  
  validateContext(context);

  const parts = encryptedValue.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc') {
    throw new PiiCryptoError('PII_FORMAT_INVALID');
  }

  if (parts[1] !== 'v1') {
    throw new PiiCryptoError('PII_VERSION_UNSUPPORTED');
  }
  const version = '1';

  const ivStr = parts[2];
  const authTagStr = parts[3];
  const ciphertextStr = parts[4];

  const key = getKey(version);
  const aad = getAAD(context, version);

  const iv = decodeStrictBase64url(ivStr, 12, 'PII_FORMAT_INVALID');
  const authTag = decodeStrictBase64url(authTagStr, 16, 'PII_FORMAT_INVALID');
  const ciphertext = decodeStrictBase64url(ciphertextStr, 'min-1', 'PII_FORMAT_INVALID');

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, {
      authTagLength: 16,
    });
    
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (err) {
    throw new PiiCryptoError('PII_DECRYPT_FAILED');
  }
}
