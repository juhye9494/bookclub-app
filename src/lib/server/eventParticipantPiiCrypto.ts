import 'server-only';
import crypto from 'crypto';

export type EventParticipantPiiField =
  | 'user_name'
  | 'user_email';

export interface EventParticipantPiiContext {
  field: EventParticipantPiiField;
  eventId: string;
  userId: string;
}

export type EventParticipantPiiCryptoErrorCode =
  | 'CONFIG_MISSING'
  | 'KEY_INVALID'
  | 'INPUT_INVALID'
  | 'FORMAT_INVALID'
  | 'VERSION_UNSUPPORTED'
  | 'DECRYPT_FAILED';

export class EventParticipantPiiCryptoError extends Error {
  constructor(public code: EventParticipantPiiCryptoErrorCode) {
    super(`[EventParticipantPiiCryptoError] ${code}`);
    this.name = 'EventParticipantPiiCryptoError';
  }
}

const EVENT_PARTICIPANT_PII_FIELDS: readonly EventParticipantPiiField[] = [
  'user_name',
  'user_email',
];

function getActiveVersion(): string {
  const version = process.env.PII_ENCRYPTION_ACTIVE_VERSION;

  if (!version) {
    throw new EventParticipantPiiCryptoError('CONFIG_MISSING');
  }

  if (version !== '1') {
    throw new EventParticipantPiiCryptoError('VERSION_UNSUPPORTED');
  }

  return version;
}

function decodeStrictBase64url(
  value: string,
  expectedLength: number | 'min-1'
): Buffer {
  if (!value || typeof value !== 'string') {
    throw new EventParticipantPiiCryptoError('FORMAT_INVALID');
  }

  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new EventParticipantPiiCryptoError('FORMAT_INVALID');
  }

  const buffer = Buffer.from(value, 'base64url');
  if (buffer.toString('base64url') !== value) {
    throw new EventParticipantPiiCryptoError('FORMAT_INVALID');
  }

  if (expectedLength === 'min-1') {
    if (buffer.length < 1) {
      throw new EventParticipantPiiCryptoError('FORMAT_INVALID');
    }
  } else {
    if (buffer.length !== expectedLength) {
      throw new EventParticipantPiiCryptoError('FORMAT_INVALID');
    }
  }

  return buffer;
}

function getEncryptionKey(version: string): Buffer {
  let keyStr = '';
  if (version === '1') {
    keyStr = process.env.PII_ENCRYPTION_KEY_V1 || '';
  } else {
    throw new EventParticipantPiiCryptoError('VERSION_UNSUPPORTED');
  }

  if (!keyStr) {
    throw new EventParticipantPiiCryptoError('CONFIG_MISSING');
  }

  try {
    return decodeStrictBase64url(keyStr, 32);
  } catch {
    throw new EventParticipantPiiCryptoError('KEY_INVALID');
  }
}

function assertEventParticipantPiiContext(context: EventParticipantPiiContext): void {
  if (!context || !context.field) {
    throw new EventParticipantPiiCryptoError('INPUT_INVALID');
  }
  if (!EVENT_PARTICIPANT_PII_FIELDS.includes(context.field)) {
    throw new EventParticipantPiiCryptoError('INPUT_INVALID');
  }
  if (typeof context.eventId !== 'string' || context.eventId.trim() === '') {
    throw new EventParticipantPiiCryptoError('INPUT_INVALID');
  }
  if (context.eventId.length > 200 || /[:\x00-\x1F\x7F]/.test(context.eventId)) {
    throw new EventParticipantPiiCryptoError('INPUT_INVALID');
  }
  if (typeof context.userId !== 'string' || context.userId.trim() === '') {
    throw new EventParticipantPiiCryptoError('INPUT_INVALID');
  }
  // Simple UUID validation for userId
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
  if (!uuidRegex.test(context.userId)) {
    throw new EventParticipantPiiCryptoError('INPUT_INVALID');
  }
}

function getAAD(context: EventParticipantPiiContext, version: string): Buffer {
  return Buffer.from(`event_participants:${context.field}:${context.eventId}:${context.userId}:v${version}`, 'utf8');
}

export function isEncryptedEventParticipantPii(value: unknown): value is string {
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

export function encryptEventParticipantPii(
  field: EventParticipantPiiField,
  eventId: string,
  userId: string,
  plaintext: string,
  keyVersion?: number
): { encryptedValue: string; keyVersion: number } {
  if (typeof plaintext !== 'string' || plaintext.trim() === '') {
    throw new EventParticipantPiiCryptoError('INPUT_INVALID');
  }

  if (field === 'user_name' && plaintext.length > 100) {
    throw new EventParticipantPiiCryptoError('INPUT_INVALID');
  }
  if (field === 'user_email' && plaintext.length > 320) {
    throw new EventParticipantPiiCryptoError('INPUT_INVALID');
  }

  const context: EventParticipantPiiContext = { field, eventId, userId };
  assertEventParticipantPiiContext(context);

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

export function decryptEventParticipantPii(
  field: EventParticipantPiiField,
  eventId: string,
  userId: string,
  encryptedValue: string,
  keyVersion: number
): string {
  if (typeof encryptedValue !== 'string' || encryptedValue.trim() === '') {
    throw new EventParticipantPiiCryptoError('INPUT_INVALID');
  }

  const context: EventParticipantPiiContext = { field, eventId, userId };
  assertEventParticipantPiiContext(context);

  const parts = encryptedValue.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc') {
    throw new EventParticipantPiiCryptoError('FORMAT_INVALID');
  }

  const versionStr = parts[1];
  if (!versionStr.startsWith('v')) {
    throw new EventParticipantPiiCryptoError('FORMAT_INVALID');
  }
  const version = versionStr.substring(1);

  if (parseInt(version, 10) !== keyVersion) {
    throw new EventParticipantPiiCryptoError('INPUT_INVALID');
  }

  if (version !== '1') {
    throw new EventParticipantPiiCryptoError('VERSION_UNSUPPORTED');
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
      throw new EventParticipantPiiCryptoError('DECRYPT_FAILED');
    }

    return decryptedStr;
  } catch (err) {
    throw new EventParticipantPiiCryptoError('DECRYPT_FAILED');
  }
}
