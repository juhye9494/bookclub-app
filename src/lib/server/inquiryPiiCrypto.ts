import 'server-only';
import crypto from 'crypto';

export type InquiryPiiField =
  | 'user_name'
  | 'user_email'
  | 'user_phone';

export interface InquiryPiiContext {
  field: InquiryPiiField;
  inquiryId: string;
}

export type InquiryPiiCryptoErrorCode =
  | 'CONFIG_MISSING'
  | 'KEY_INVALID'
  | 'INPUT_INVALID'
  | 'FORMAT_INVALID'
  | 'VERSION_UNSUPPORTED'
  | 'DECRYPT_FAILED';

export class InquiryPiiCryptoError extends Error {
  constructor(public code: InquiryPiiCryptoErrorCode) {
    super(`[InquiryPiiCryptoError] ${code}`);
    this.name = 'InquiryPiiCryptoError';
  }
}

const INQUIRY_PII_FIELDS: readonly InquiryPiiField[] = [
  'user_name',
  'user_email',
  'user_phone',
];

function getActiveVersion(): string {
  const version = process.env.PII_ENCRYPTION_ACTIVE_VERSION;

  if (!version) {
    throw new InquiryPiiCryptoError('CONFIG_MISSING');
  }

  if (version !== '1') {
    throw new InquiryPiiCryptoError('VERSION_UNSUPPORTED');
  }

  return version;
}

function decodeStrictBase64url(
  value: string,
  expectedLength: number | 'min-1'
): Buffer {
  if (!value || typeof value !== 'string') {
    throw new InquiryPiiCryptoError('FORMAT_INVALID');
  }

  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new InquiryPiiCryptoError('FORMAT_INVALID');
  }

  const buffer = Buffer.from(value, 'base64url');
  if (buffer.toString('base64url') !== value) {
    throw new InquiryPiiCryptoError('FORMAT_INVALID');
  }

  if (expectedLength === 'min-1') {
    if (buffer.length < 1) {
      throw new InquiryPiiCryptoError('FORMAT_INVALID');
    }
  } else {
    if (buffer.length !== expectedLength) {
      throw new InquiryPiiCryptoError('FORMAT_INVALID');
    }
  }

  return buffer;
}

function getEncryptionKey(version: string): Buffer {
  let keyStr = '';
  if (version === '1') {
    keyStr = process.env.PII_ENCRYPTION_KEY_V1 || '';
  } else {
    throw new InquiryPiiCryptoError('VERSION_UNSUPPORTED');
  }

  if (!keyStr) {
    throw new InquiryPiiCryptoError('CONFIG_MISSING');
  }

  try {
    return decodeStrictBase64url(keyStr, 32);
  } catch {
    throw new InquiryPiiCryptoError('KEY_INVALID');
  }
}

function assertInquiryPiiContext(context: InquiryPiiContext): void {
  if (!context || !context.field) {
    throw new InquiryPiiCryptoError('INPUT_INVALID');
  }
  if (!INQUIRY_PII_FIELDS.includes(context.field)) {
    throw new InquiryPiiCryptoError('INPUT_INVALID');
  }
  if (typeof context.inquiryId !== 'string' || context.inquiryId.trim() === '') {
    throw new InquiryPiiCryptoError('INPUT_INVALID');
  }
  // Simple UUID validation
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
  if (!uuidRegex.test(context.inquiryId)) {
    throw new InquiryPiiCryptoError('INPUT_INVALID');
  }
}

function getAAD(context: InquiryPiiContext, version: string): Buffer {
  return Buffer.from(`inquiries:${context.field}:${context.inquiryId}:v${version}`, 'utf8');
}

export function isEncryptedInquiryPii(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const parts = value.split(':');
  if (parts.length !== 5) return false;
  if (parts[0] !== 'enc') return false;
  if (!/^v\d+$/.test(parts[1])) return false;

  const b64urlRegex = /^[A-Za-z0-9_-]+$/;
  if (!parts[2] || !b64urlRegex.test(parts[2])) return false;
  if (!parts[3] || !b64urlRegex.test(parts[3])) return false;
  if (!parts[4] || !b64urlRegex.test(parts[4])) return false;

  return true;
}

export function encryptInquiryPii(
  field: InquiryPiiField,
  inquiryId: string,
  plaintext: string,
  keyVersion?: number
): { encryptedValue: string; keyVersion: number } {
  if (typeof plaintext !== 'string' || plaintext.trim() === '') {
    throw new InquiryPiiCryptoError('INPUT_INVALID');
  }

  const context: InquiryPiiContext = { field, inquiryId };
  assertInquiryPiiContext(context);

  const version = keyVersion ? keyVersion.toString() : getActiveVersion();
  const key = getEncryptionKey(version);
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

  const encryptedValue = `enc:v${version}:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;

  return {
    encryptedValue,
    keyVersion: parseInt(version, 10)
  };
}

export function decryptInquiryPii(
  field: InquiryPiiField,
  inquiryId: string,
  encryptedValue: string,
  keyVersion: number
): string {
  if (typeof encryptedValue !== 'string' || encryptedValue.trim() === '') {
    throw new InquiryPiiCryptoError('INPUT_INVALID');
  }

  const context: InquiryPiiContext = { field, inquiryId };
  assertInquiryPiiContext(context);

  const parts = encryptedValue.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc') {
    throw new InquiryPiiCryptoError('FORMAT_INVALID');
  }

  const versionStr = parts[1];
  if (!versionStr.startsWith('v')) {
    throw new InquiryPiiCryptoError('FORMAT_INVALID');
  }
  const version = versionStr.substring(1);

  if (parseInt(version, 10) !== keyVersion) {
    throw new InquiryPiiCryptoError('INPUT_INVALID');
  }

  if (version !== '1') {
    throw new InquiryPiiCryptoError('VERSION_UNSUPPORTED');
  }

  const ivStr = parts[2];
  const authTagStr = parts[3];
  const ciphertextStr = parts[4];

  const key = getEncryptionKey(version);
  const aad = getAAD(context, version);

  const iv = decodeStrictBase64url(ivStr, 12);
  const authTag = decodeStrictBase64url(authTagStr, 16);
  const ciphertext = decodeStrictBase64url(ciphertextStr, 'min-1');

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

    const decryptedStr = decrypted.toString('utf8');
    if (decryptedStr.trim() === '') {
      throw new InquiryPiiCryptoError('DECRYPT_FAILED');
    }

    return decryptedStr;
  } catch (err) {
    throw new InquiryPiiCryptoError('DECRYPT_FAILED');
  }
}
