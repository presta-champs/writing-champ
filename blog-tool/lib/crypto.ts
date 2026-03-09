import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT = "writingchamps_api_keys_v1";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "ENCRYPTION_SECRET environment variable is not set. " +
      "API key encryption/decryption requires this variable. " +
      "Set it to a cryptographically random string of at least 32 characters."
    );
  }
  return scryptSync(secret, SALT, 32);
}

/**
 * Encrypt a plaintext string. Returns a hex-encoded string containing IV + tag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  // iv (32 hex) + tag (32 hex) + ciphertext
  return iv.toString("hex") + tag.toString("hex") + encrypted;
}

/**
 * Decrypt a hex-encoded encrypted string. Returns the original plaintext.
 */
export function decrypt(encryptedHex: string): string {
  const key = getKey();
  const iv = Buffer.from(encryptedHex.slice(0, IV_LENGTH * 2), "hex");
  const tag = Buffer.from(encryptedHex.slice(IV_LENGTH * 2, IV_LENGTH * 2 + TAG_LENGTH * 2), "hex");
  const ciphertext = encryptedHex.slice(IV_LENGTH * 2 + TAG_LENGTH * 2);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Mask an API key for display: show first 8 chars and last 4.
 */
export function maskKey(key: string): string {
  if (key.length <= 12) return "****";
  return key.slice(0, 8) + "..." + key.slice(-4);
}
