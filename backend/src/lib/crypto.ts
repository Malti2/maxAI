// Symmetric encryption for secrets stored in the database (e.g. provider API keys).
//
// Uses AES-256-GCM. The key is taken from ENCRYPTION_KEY (32-byte hex) when set,
// otherwise derived deterministically from JWT_SECRET — so a stock install needs
// no extra configuration, while operators can supply a dedicated key.
//
// A stored value looks like: v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>

import crypto from 'crypto';
import { env } from './env';

function getKey(): Buffer {
  const explicit = env.ENCRYPTION_KEY;
  if (explicit) {
    // Accept a 64-char hex key directly, otherwise hash whatever was provided.
    if (/^[0-9a-fA-F]{64}$/.test(explicit)) return Buffer.from(explicit, 'hex');
    return crypto.createHash('sha256').update(explicit).digest();
  }
  return crypto.createHash('sha256').update(`maxai::${env.JWT_SECRET}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Malformed encrypted value');
  }
  const [, ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

// Show only the last few characters of a secret, e.g. "••••1a2b".
export function maskSecret(plain: string): string {
  if (!plain) return '';
  const tail = plain.slice(-4);
  return `••••${tail}`;
}
