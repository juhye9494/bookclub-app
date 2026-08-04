import 'server-only';
import crypto from 'crypto';

export type OrderPiiField =
  | 'user_name'
  | 'user_email'
  | 'user_phone'
  | 'user_address';

export type OrderPiiHmacField =
  | 'user_name'
  | 'user_email';

export interface OrderPiiContext {
  field: OrderPiiField;
  paymentOrderId: string;
}

export interface OrderPiiHmacContext {
  field: OrderPiiHmacField;
}

export type OrderPiiCryptoErrorCode =
  | 'CONFIG_MISSING'
  | 'KEY_INVALID'
  | 'INPUT_INVALID'
  | 'FORMAT_INVALID'
  | 'VERSION_UNSUPPORTED'
  | 'DECRYPT_FAILED';

export class OrderPiiCryptoError extends Error {
  constructor(public code: OrderPiiCryptoErrorCode) {
    super(`[OrderPiiCryptoError] ${code}`);
    this.name = 'OrderPiiCryptoError';
  }
}

const ORDER_PII_FIELDS: readonly OrderPiiField[] = [
  'user_name',
  'user_email',
  'user_phone',
  'user_address',
];

const ORDER_PII_HMAC_FIELDS: readonly OrderPiiHmacField[] = [
  'user_name',
  'user_email',
];

// ---------------------------------------------------------
// Helper functions
// ---------------------------------------------------------

function getActiveVersion(): string {
  const version = process.env.PII_ENCRYPTION_ACTIVE_VERSION;
  
  if (!version) {
    throw new OrderPiiCryptoError('CONFIG_MISSING');
  }

  if (version !== '1') {
    throw new OrderPiiCryptoError('VERSION_UNSUPPORTED');
  }

  return version;
}

function decodeStrictBase64url(
  value: string,
  expectedLength: number | 'min-1'
): Buffer {
  if (!value || typeof value !== 'string') {
    throw new OrderPiiCryptoError('FORMAT_INVALID');
  }

  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new OrderPiiCryptoError('FORMAT_INVALID');
  }

  const buffer = Buffer.from(value, 'base64url');
  if (buffer.toString('base64url') !== value) {
    throw new OrderPiiCryptoError('FORMAT_INVALID');
  }

  if (expectedLength === 'min-1') {
    if (buffer.length < 1) {
      throw new OrderPiiCryptoError('FORMAT_INVALID');
    }
  } else {
    if (buffer.length !== expectedLength) {
      throw new OrderPiiCryptoError('FORMAT_INVALID');
    }
  }

  return buffer;
}

function getEncryptionKey(version: string): Buffer {
  let keyStr = '';
  if (version === '1') {
    keyStr = process.env.PII_ENCRYPTION_KEY_V1 || '';
  } else {
    throw new OrderPiiCryptoError('VERSION_UNSUPPORTED');
  }

  if (!keyStr) {
    throw new OrderPiiCryptoError('CONFIG_MISSING');
  }

  try {
    return decodeStrictBase64url(keyStr, 32);
  } catch {
    throw new OrderPiiCryptoError('KEY_INVALID');
  }
}

function getHmacKey(version: string): Buffer {
  let keyStr = '';
  if (version === '1') {
    keyStr = process.env.PII_HMAC_KEY_V1 || '';
  } else {
    throw new OrderPiiCryptoError('VERSION_UNSUPPORTED');
  }

  if (!keyStr) {
    throw new OrderPiiCryptoError('CONFIG_MISSING');
  }

  try {
    return decodeStrictBase64url(keyStr, 32);
  } catch {
    throw new OrderPiiCryptoError('KEY_INVALID');
  }
}

function assertOrderPiiContext(context: OrderPiiContext): void {
  if (!context || !context.field) {
    throw new OrderPiiCryptoError('INPUT_INVALID');
  }
  if (!ORDER_PII_FIELDS.includes(context.field)) {
    throw new OrderPiiCryptoError('INPUT_INVALID');
  }
  if (typeof context.paymentOrderId !== 'string' || context.paymentOrderId.trim() === '') {
    throw new OrderPiiCryptoError('INPUT_INVALID');
  }
}

function getAAD(context: OrderPiiContext, version: string): Buffer {
  return Buffer.from(`orders:${context.field}:${context.paymentOrderId}:v${version}`, 'utf8');
}

// ---------------------------------------------------------
// Public API
// ---------------------------------------------------------

/**
 * Checks if the string matches the expected encryption format.
 * Note: This only checks the structure, not the cryptographic integrity.
 */
export function isEncryptedOrderPii(value: unknown): value is string {
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

export function encryptOrderPii(
  plaintext: string,
  context: OrderPiiContext
): string {
  if (typeof plaintext !== 'string' || plaintext.trim() === '') {
    throw new OrderPiiCryptoError('INPUT_INVALID');
  }
  
  assertOrderPiiContext(context);

  const version = getActiveVersion();
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

  return `enc:v${version}:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptOrderPii(
  encryptedValue: string,
  context: OrderPiiContext
): string {
  if (typeof encryptedValue !== 'string' || encryptedValue.trim() === '') {
    throw new OrderPiiCryptoError('INPUT_INVALID');
  }
  
  assertOrderPiiContext(context);

  const parts = encryptedValue.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc') {
    throw new OrderPiiCryptoError('FORMAT_INVALID');
  }

  const versionStr = parts[1];
  if (!versionStr.startsWith('v')) {
    throw new OrderPiiCryptoError('FORMAT_INVALID');
  }
  const version = versionStr.substring(1);
  
  if (version !== '1') {
    throw new OrderPiiCryptoError('VERSION_UNSUPPORTED');
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

    return decrypted.toString('utf8');
  } catch (err) {
    throw new OrderPiiCryptoError('DECRYPT_FAILED');
  }
}

/**
 * Checks if the string matches the expected HMAC format.
 * Note: This only checks the structure, not the cryptographic integrity.
 */
export function isOrderPiiHmac(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const parts = value.split(':');
  if (parts.length !== 3) return false;
  if (parts[0] !== 'hmac') return false;
  if (!/^v\d+$/.test(parts[1])) return false;

  const b64urlRegex = /^[A-Za-z0-9_-]+$/;
  if (!parts[2] || !b64urlRegex.test(parts[2])) return false;

  return true;
}

export function createOrderPiiHmac(
  value: string,
  context: OrderPiiHmacContext
): string {
  if (typeof value !== 'string') {
    throw new OrderPiiCryptoError('INPUT_INVALID');
  }
  if (!context || !context.field) {
    throw new OrderPiiCryptoError('INPUT_INVALID');
  }
  if (!ORDER_PII_HMAC_FIELDS.includes(context.field)) {
    throw new OrderPiiCryptoError('INPUT_INVALID');
  }

  let normalizedValue = '';
  
  if (context.field === 'user_email') {
    normalizedValue = value.normalize('NFKC').trim().toLowerCase();
  } else if (context.field === 'user_name') {
    normalizedValue = value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  } else {
    throw new OrderPiiCryptoError('INPUT_INVALID');
  }

  if (normalizedValue === '') {
    throw new OrderPiiCryptoError('INPUT_INVALID');
  }

  const version = getActiveVersion();
  const key = getHmacKey(version);

  const message = `orders:${context.field}:${normalizedValue}:v${version}`;
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(message, 'utf8');
  const digest = hmac.digest('base64url');

  return `hmac:v${version}:${digest}`;
}
