import 'server-only';
import crypto from 'crypto';

export type BookOrderPiiField =
  | 'shipping_name'
  | 'shipping_phone'
  | 'shipping_address'
  | 'delivery_note';

export interface BookOrderPiiContext {
  field: BookOrderPiiField;
  bookOrderId: string;
}

export type BookOrderPiiCryptoErrorCode =
  | 'CONFIG_MISSING'
  | 'KEY_INVALID'
  | 'INPUT_INVALID'
  | 'FORMAT_INVALID'
  | 'VERSION_UNSUPPORTED'
  | 'DECRYPT_FAILED';

export class BookOrderPiiCryptoError extends Error {
  constructor(public code: BookOrderPiiCryptoErrorCode) {
    super(`[BookOrderPiiCryptoError] ${code}`);
    this.name = 'BookOrderPiiCryptoError';
  }
}

const BOOK_ORDER_PII_FIELDS: readonly BookOrderPiiField[] = [
  'shipping_name',
  'shipping_phone',
  'shipping_address',
  'delivery_note',
];

function getActiveVersion(): string {
  const version = process.env.PII_ENCRYPTION_ACTIVE_VERSION;
  
  if (!version) {
    throw new BookOrderPiiCryptoError('CONFIG_MISSING');
  }

  if (version !== '1') {
    throw new BookOrderPiiCryptoError('VERSION_UNSUPPORTED');
  }

  return version;
}

function decodeStrictBase64url(
  value: string,
  expectedLength: number | 'min-1'
): Buffer {
  if (!value || typeof value !== 'string') {
    throw new BookOrderPiiCryptoError('FORMAT_INVALID');
  }

  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new BookOrderPiiCryptoError('FORMAT_INVALID');
  }

  const buffer = Buffer.from(value, 'base64url');
  if (buffer.toString('base64url') !== value) {
    throw new BookOrderPiiCryptoError('FORMAT_INVALID');
  }

  if (expectedLength === 'min-1') {
    if (buffer.length < 1) {
      throw new BookOrderPiiCryptoError('FORMAT_INVALID');
    }
  } else {
    if (buffer.length !== expectedLength) {
      throw new BookOrderPiiCryptoError('FORMAT_INVALID');
    }
  }

  return buffer;
}

function getEncryptionKey(version: string): Buffer {
  let keyStr = '';
  if (version === '1') {
    keyStr = process.env.PII_ENCRYPTION_KEY_V1 || '';
  } else {
    throw new BookOrderPiiCryptoError('VERSION_UNSUPPORTED');
  }

  if (!keyStr) {
    throw new BookOrderPiiCryptoError('CONFIG_MISSING');
  }

  try {
    return decodeStrictBase64url(keyStr, 32);
  } catch {
    throw new BookOrderPiiCryptoError('KEY_INVALID');
  }
}

function assertBookOrderPiiContext(context: BookOrderPiiContext): void {
  if (!context || !context.field) {
    throw new BookOrderPiiCryptoError('INPUT_INVALID');
  }
  if (!BOOK_ORDER_PII_FIELDS.includes(context.field)) {
    throw new BookOrderPiiCryptoError('INPUT_INVALID');
  }
  if (typeof context.bookOrderId !== 'string' || context.bookOrderId.trim() === '') {
    throw new BookOrderPiiCryptoError('INPUT_INVALID');
  }
  // Simple UUID validation
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
  if (!uuidRegex.test(context.bookOrderId)) {
    throw new BookOrderPiiCryptoError('INPUT_INVALID');
  }
}

function getAAD(context: BookOrderPiiContext, version: string): Buffer {
  return Buffer.from(`book_orders:${context.field}:${context.bookOrderId}:v${version}`, 'utf8');
}

export function isEncryptedBookOrderPii(value: unknown): value is string {
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

export function encryptBookOrderPii(
  field: BookOrderPiiField,
  bookOrderId: string,
  plaintext: string,
  keyVersion?: number
): { encryptedValue: string; keyVersion: number } {
  if (typeof plaintext !== 'string' || plaintext.trim() === '') {
    throw new BookOrderPiiCryptoError('INPUT_INVALID');
  }
  
  const context: BookOrderPiiContext = { field, bookOrderId };
  assertBookOrderPiiContext(context);

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

export function decryptBookOrderPii(
  field: BookOrderPiiField,
  bookOrderId: string,
  encryptedValue: string,
  keyVersion: number
): string {
  if (typeof encryptedValue !== 'string' || encryptedValue.trim() === '') {
    throw new BookOrderPiiCryptoError('INPUT_INVALID');
  }
  
  const context: BookOrderPiiContext = { field, bookOrderId };
  assertBookOrderPiiContext(context);

  const parts = encryptedValue.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc') {
    throw new BookOrderPiiCryptoError('FORMAT_INVALID');
  }

  const versionStr = parts[1];
  if (!versionStr.startsWith('v')) {
    throw new BookOrderPiiCryptoError('FORMAT_INVALID');
  }
  const version = versionStr.substring(1);
  
  if (parseInt(version, 10) !== keyVersion) {
    throw new BookOrderPiiCryptoError('INPUT_INVALID');
  }
  
  if (version !== '1') {
    throw new BookOrderPiiCryptoError('VERSION_UNSUPPORTED');
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
      throw new BookOrderPiiCryptoError('DECRYPT_FAILED');
    }

    return decryptedStr;
  } catch (err) {
    throw new BookOrderPiiCryptoError('DECRYPT_FAILED');
  }
}
