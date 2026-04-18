import type { Context, Next } from 'hono';
import pino from 'pino';

const logger = pino({ name: 'turnstile' });
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Cloudflare Turnstile verification middleware.
 * Reads turnstile_token from the JSON body. Hono v4 memoizes c.req.json()
 * internally, so downstream handlers calling c.req.json() again receive
 * the same cached result. This is documented Hono behavior, not a hack.
 *
 * - Dev (no TURNSTILE_SECRET_KEY): no-op, requests pass through.
 * - Production: required. Fails CLOSED if Turnstile API is unreachable.
 */
export async function turnstileMiddleware(c: Context, next: Next) {
  if (!TURNSTILE_SECRET) {
    await next();
    return;
  }

  const body = await c.req.json();
  const token = body.turnstile_token;

  if (!token) {
    return c.json(
      { ok: false, error: 'Verification required. Please complete the challenge.', code: 'TURNSTILE_MISSING' },
      403
    );
  }

  // Use x-forwarded-for only (not cf-connecting-ip which is spoofable if not behind Cloudflare)
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? '';

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
      }),
    });

    const result = await res.json() as { success: boolean; 'error-codes'?: string[] };

    if (!result.success) {
      logger.warn({ ip, errors: result['error-codes'] }, 'Turnstile verification failed');
      return c.json(
        { ok: false, error: 'Verification failed. Please try again.', code: 'TURNSTILE_FAILED' },
        403
      );
    }
  } catch (err) {
    logger.error(err, 'Turnstile API call failed');
    // Fail CLOSED in production — reject the request
    if (isProduction) {
      return c.json(
        { ok: false, error: 'Verification service unavailable. Please try again shortly.', code: 'TURNSTILE_UNAVAILABLE' },
        503
      );
    }
    // Dev: fail open
  }

  await next();
}
