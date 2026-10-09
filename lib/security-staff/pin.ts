import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * PIN hashing for `SecurityStaff.pinHash` — scrypt (Node's built-in
 * `node:crypto`, no extra dependency) rather than a general-purpose hash.
 * A PIN is only 4-6 digits, i.e. at most a million possibilities, so the hash
 * MUST be deliberately slow; scrypt's memory-hardness is exactly that.
 *
 * Stored as `<saltHex>:<hashHex>` — one column, no second one to keep in
 * sync.
 */

const KEY_LENGTH = 64;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Constant-time compare. Also tolerates a malformed stored value (should
 * never happen outside a hand-edited database) by failing closed rather than
 * throwing past the caller's lockout bookkeeping.
 */
export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(pin, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * A hash of a PIN nobody could ever type (used when the username does not
 * exist at all), so a failed login takes the same amount of work either way
 * and cannot be used to discover which usernames are registered by timing.
 */
const DUMMY_HASH = hashPin("000000000000000000");

export function verifyAgainstDummy(pin: string): boolean {
  return verifyPin(pin, DUMMY_HASH);
}
