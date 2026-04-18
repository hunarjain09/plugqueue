import webpush from 'web-push';
import pg from 'pg';
import pino from 'pino';

const logger = pino({ name: 'push' });

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@plugqueue.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function sendPushNotification(
  pool: pg.Pool,
  subId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<void> {
  const { rows } = await pool.query(
    'select endpoint, p256dh, auth from push_subscriptions where id = $1',
    [subId]
  );

  if (rows.length === 0) {
    logger.warn({ subId }, 'Push subscription not found');
    return;
  }

  const sub = rows[0];
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    );
    await pool.query(
      'update push_subscriptions set last_used_at = now() where id = $1',
      [subId]
    );
    logger.info({ subId }, 'Push notification sent');
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await pool.query('delete from push_subscriptions where id = $1', [subId]);
      logger.info({ subId }, 'Removed expired push subscription');
    } else {
      logger.error(err, 'Push notification failed');
    }
  }
}
