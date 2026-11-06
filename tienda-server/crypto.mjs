import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  }).toString("hex");
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [algo, n, r, p, salt, hash] = String(stored).split("$");
    if (algo !== "scrypt" || !salt || !hash) return false;
    const expected = Buffer.from(hash, "hex");
    if (expected.length === 0) return false;
    const actual = scryptSync(String(password), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT_MAXMEM,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}
