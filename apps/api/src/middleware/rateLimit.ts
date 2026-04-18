import type { Context, Next } from 'hono';
import { checkRateLimit, checkIpRateLimit } from '../lib/redis.js';
import type { AppEnv } from '../env.js';
import pino from 'pino';

const logger = pino({ name: 'rate-limit' });

/**
 * Dual rate limiter: checks both device hash AND IP address.
 * Device hash alone is trivially spoofed via DevTools or curl.
 * IP adds a harder-to-bypass layer.
 */
export async function rateLimitMiddleware(c: Context<AppEnv>, next: Next) {
  const deviceHash = c.req.header('x-device-hash');
  if (!deviceHash) {
    return c.json({ ok: false, error: 'Missing x-device-hash header' }, 400);
  }

  // Extract real IP from x-forwarded-for (set by Railway's edge proxy).
  // Do NOT trust cf-connecting-ip — it's spoofable unless behind Cloudflare.
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';

  try {
    // Check both in parallel
    await Promise.all([
      checkRateLimit(deviceHash, 30, 60),   // 30 req/min per device
      checkIpRateLimit(ip, 60, 60),          // 60 req/min per IP
    ]);
  } catch (err: any) {
    const isIp = err.message === 'IP_RATE_LIMITED';
    logger.warn({ ip, deviceHash, type: isIp ? 'ip' : 'device' }, 'Rate limited');
    return c.json(
      { ok: false, error: 'Rate limited. Try again later.', code: 'RATE_LIMITED' },
      429
    );
  }

  // Attach IP to context for downstream use (multi-device detection)
  c.set('clientIp', ip);

  await next();
}
