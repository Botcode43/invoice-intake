import crypto from "crypto";

/**
 * Hashes a plaintext password using crypto.scrypt with a random salt.
 * Stored format: "<saltHex>:<hashHex>"
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored "<saltHex>:<hashHex>" string
 * using timing-safe comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 2) {
      return false;
    }
    const [salt, hash] = parts;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const storedKey = Buffer.from(hash, "hex");

    if (derivedKey.length !== storedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, storedKey);
  } catch {
    return false;
  }
}
