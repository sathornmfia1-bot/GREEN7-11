import 'server-only';
import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// hash รหัสผ่านด้วย scrypt (มีใน Node ไม่ต้องติดตั้งเพิ่ม) · รูปแบบ: scrypt$N$r$p$salt$hash (base64)
const params = { N: 16384, r: 8, p: 1 };
const keyLength = 64;

function derive(secret: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(secret, salt, keyLength, { ...options, maxmem: 64 * 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(key))));
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(secret, salt, params);
  return ['scrypt', params.N, params.r, params.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(secret, Buffer.from(salt, 'base64'), { N: Number(N), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function sixDigitCode() {
  return String(randomInt(100000, 1000000));
}

export const minPasswordLength = 8;
export const maxFailedAttempts = 5;
export const lockMinutes = 15;
export const resetCodeMinutes = 5;
export const maxResetAttempts = 5;

export function passwordProblem(password: string): string | null {
  if (password.length < minPasswordLength) return `รหัสผ่านต้องมีอย่างน้อย ${minPasswordLength} ตัวอักษร`;
  if (password.length > 128) return 'รหัสผ่านยาวเกินไป';
  return null;
}
