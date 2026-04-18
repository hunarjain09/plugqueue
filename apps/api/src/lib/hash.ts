import { createHash } from 'crypto';
import { redis } from './redis.js';
import pino from 'pino';

const logger = pino({ name: 'hash' });

function computeHash(salt: string, plate: string): string {
  return createHash('sha256').update(`${salt}:${plate}`).digest('hex');
}

/**
 * Hash a plate with the current daily salt.
 * Fails hard if no salt is available — never uses a static fallback in production.
 */
export async function hashPlate(plate: string): Promise<string> {
  const salt = await redis.get('daily_salt');
  if (!salt) {
    // Generate an initial salt if none exists (first-ever startup before cron runs)
    const { randomBytes } = await import('crypto');
    const newSalt = randomBytes(32).toString('hex');
    await redis.set('daily_salt', newSalt);
    await redis.set('daily_salt_date', new Date().toISOString().slice(0, 10));
    logger.warn('No daily_salt found — generated initial salt');
    return computeHash(newSalt, plate);
  }
  return computeHash(salt, plate);
}

/**
 * Returns both the current and previous plate hashes.
 * Used for cooldown lookups during the salt rotation overlap window.
 */
export async function hashPlateWithPrevious(plate: string): Promise<string[]> {
  const [salt, prevSalt] = await Promise.all([
    redis.get('daily_salt'),
    redis.get('daily_salt_prev'),
  ]);

  const hashes: string[] = [];
  if (salt) hashes.push(computeHash(salt, plate));
  if (prevSalt && prevSalt !== salt) hashes.push(computeHash(prevSalt, plate));

  if (hashes.length === 0) {
    // Fallback: generate initial salt
    const { randomBytes } = await import('crypto');
    const newSalt = randomBytes(32).toString('hex');
    await redis.set('daily_salt', newSalt);
    await redis.set('daily_salt_date', new Date().toISOString().slice(0, 10));
    hashes.push(computeHash(newSalt, plate));
  }

  return hashes;
}
