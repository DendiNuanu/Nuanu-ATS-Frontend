import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Hash a password using Node's built-in scrypt KDF.
 * Returns a string in the format `salt:hash` (both hex-encoded).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a plaintext password against a stored `salt:hash` string.
 * Falls back to plaintext comparison for legacy records that were
 * stored before hashing was introduced.
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;

  // Legacy plaintext passwords (no colon separator)
  if (!stored.includes(":")) {
    return password === stored;
  }

  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  try {
    const hashBuf = scryptSync(password, salt, 64);
    return timingSafeEqual(hashBuf, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
