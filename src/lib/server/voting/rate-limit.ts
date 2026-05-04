import { createHash, randomBytes } from 'node:crypto';
import { redis } from '../redis';

const SALT_TTL_SEC = 48 * 60 * 60;
const RATE_WINDOW_SEC = 60;
const RATE_MAX = 30;
const MIN_VOTED_TTL_SEC = 60;

function todaySaltKey(): string {
  const d = new Date();
  return `salt:${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function getOrCreateSalt(): Promise<string> {
  const key = todaySaltKey();
  const existing = await redis.get(key);
  if (existing) return existing;
  const salt = randomBytes(32).toString('hex');
  await redis.setex(key, SALT_TTL_SEC, salt);
  return salt;
}

async function ipHash(ip: string): Promise<string> {
  const salt = await getOrCreateSalt();
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex');
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const hash = await ipHash(ip);
  const key = `rl:${hash}`;
  const cnt = await redis.incr(key);
  if (cnt === 1) await redis.expire(key, RATE_WINDOW_SEC);
  if (cnt > RATE_MAX) {
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfterSec: ttl > 0 ? ttl : RATE_WINDOW_SEC };
  }
  return { allowed: true };
}

export async function hasVoted(ip: string, code: string): Promise<boolean> {
  const hash = await ipHash(ip);
  return (await redis.exists(`voted:${hash}:${code}`)) === 1;
}

export async function markVoted(ip: string, code: string, expiresAt: Date): Promise<void> {
  const hash = await ipHash(ip);
  const ttlSec = Math.max(MIN_VOTED_TTL_SEC, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  await redis.setex(`voted:${hash}:${code}`, ttlSec, '1');
}
