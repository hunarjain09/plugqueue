import { Hono } from 'hono';
import { pool } from '../lib/db.js';
import { pushSubscribeSchema } from '@plugqueue/shared';
import pino from 'pino';

const logger = pino({ name: 'push' });

// Known Web Push service domains
const ALLOWED_PUSH_DOMAINS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
  'web.push.apple.com',
];

function isValidPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return ALLOWED_PUSH_DOMAINS.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

const app = new Hono();

// POST /api/push/subscribe
app.post('/subscribe', async (c) => {
  const body = await c.req.json();
  const parsed = pushSubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const { id, endpoint, p256dh, auth, device_hash } = parsed.data;

  // Validate endpoint is a known push service domain
  if (!isValidPushEndpoint(endpoint)) {
    logger.warn({ endpoint, device_hash }, 'Push subscribe rejected: unknown endpoint domain');
    return c.json(
      { ok: false, error: 'Invalid push endpoint.', code: 'INVALID_ENDPOINT' },
      400
    );
  }

  // Upsert — only allow overwrite if device_hash matches (prevents subscription hijacking)
  await pool.query(
    `insert into push_subscriptions (id, endpoint, p256dh, auth, device_hash)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do update
     set endpoint = excluded.endpoint,
         p256dh = excluded.p256dh,
         auth = excluded.auth
     where push_subscriptions.device_hash = excluded.device_hash`,
    [id, endpoint, p256dh, auth, device_hash]
  );

  return c.json({ ok: true, data: { subscribed: true } });
});

// DELETE /api/push/subscribe/:id — requires matching device_hash
app.delete('/subscribe/:id', async (c) => {
  const id = c.req.param('id');
  const deviceHash = c.req.header('x-device-hash');

  if (!deviceHash) {
    return c.json({ ok: false, error: 'Missing x-device-hash header' }, 400);
  }

  const { rowCount } = await pool.query(
    'delete from push_subscriptions where id = $1 and device_hash = $2',
    [id, deviceHash]
  );

  if (rowCount === 0) {
    return c.json({ ok: false, error: 'Subscription not found or not owned by this device' }, 404);
  }

  return c.json({ ok: true, data: { unsubscribed: true } });
});

// GET /api/push/vapid-key
app.get('/vapid-key', (c) => {
  return c.json({
    ok: true,
    data: { key: process.env.VAPID_PUBLIC_KEY ?? '' },
  });
});

export default app;
