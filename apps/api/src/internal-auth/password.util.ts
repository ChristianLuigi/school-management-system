import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Hashes a password using scrypt.
 * Stored format:  scrypt:<saltHex>:<derivedHex>
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash.startsWith('scrypt:')) return false;

  const [, saltHex, derivedHex] = storedHash.split(':');
  if (!saltHex || !derivedHex) return false;

  const derivedBuffer = Buffer.from(derivedHex, 'hex');
  const candidate = scryptSync(password, Buffer.from(saltHex, 'hex'), 64);

  if (candidate.length !== derivedBuffer.length) return false;

  return timingSafeEqual(candidate, derivedBuffer);
}
