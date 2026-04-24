import { randomBytes } from "crypto";

/**
 * Generates an opaque, URL-safe QR token for encoding into QR images.
 *
 * Uses crypto.randomBytes(16) → base64url encoding:
 * - 22 characters (URL-safe alphabet: A-Za-z0-9-_)
 * - ~128 bits of entropy
 * - No external dependencies
 *
 * Deliberately NOT the same as the qr_codes.id primary key so that the
 * internal DB identity is never coupled to the printed token payload.
 * Token format can evolve independently (e.g., versioned prefixes) by
 * changing only this function.
 */
export function generateQrToken(): string {
  return randomBytes(16).toString("base64url");
}
