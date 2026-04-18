import pg from 'pg';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import {
  NOTIFICATION_CONFIRM_WINDOW_SEC,
  QUEUE_ENTRY_TTL_SEC,
  ENTRY_PURGE_AGE_SEC,
  SNAPSHOT_PURGE_AGE_SEC,
} from '@plugqueue/shared';

async function main() {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  await db.connect();
  console.log('[cron] Connected to database');

  // Disable queue trigger during bulk operations to prevent NOTIFY storm.
  // Each row update/delete would fire pg_notify individually — for 500 rows
  // that's 500 redundant broadcasts. We handle notifications manually below.
  await db.query('ALTER TABLE queue_entries DISABLE TRIGGER queue_entries_change');

  // 1. Expire stale queue entries (waiting too long)
  const expired = await db.query(
    `update queue_entries set status = 'expired'
     where status in ('waiting', 'notified')
       and joined_at < now() - interval '1 second' * $1`,
    [QUEUE_ENTRY_TTL_SEC]
  );
  console.log(`[cron] Expired ${expired.rowCount} stale queue entries (>${QUEUE_ENTRY_TTL_SEC / 3600}h)`);

  // 2. Safety-net for notified entries — the API in-process timer is primary owner.
  // Cron fires pg_notify so the worker advances the queue if timer missed anything.
  const { rows: staleNotified } = await db.query(
    `update queue_entries set status = 'expired'
     where status = 'notified'
       and notified_at < now() - interval '1 second' * $1
     returning station_id`,
    [NOTIFICATION_CONFIRM_WINDOW_SEC]
  );
  if (staleNotified.length > 0) {
    const stationIds = [...new Set(staleNotified.map((r: any) => r.station_id))];
    for (const sid of stationIds) {
      await db.query(
        `select pg_notify('stall_changed', $1)`,
        [JSON.stringify({
          station_id: sid,
          stall_label: 'cron-safety',
          old_status: 'notified_expired',
          new_status: 'available',
          changed_at: new Date().toISOString(),
        })]
      );
    }
    console.log(`[cron] Safety-net: expired ${staleNotified.length} stale notifications, triggered queue advance for ${stationIds.length} station(s)`);
  }

  // 3. Purge old completed/expired entries
  const purged = await db.query(
    `delete from queue_entries
     where status in ('expired', 'left', 'charging')
       and joined_at < now() - interval '1 second' * $1`,
    [ENTRY_PURGE_AGE_SEC]
  );
  console.log(`[cron] Purged ${purged.rowCount} old queue entries (>${ENTRY_PURGE_AGE_SEC / 3600}h)`);

  // 4. Clean expired cooldowns
  const cooldowns = await db.query('delete from cooldowns where expires_at < now()');
  console.log(`[cron] Cleaned ${cooldowns.rowCount} expired cooldowns`);

  // 5. Purge old snapshots
  const snapshots = await db.query(
    `delete from station_snapshots where submitted_at < now() - interval '1 second' * $1`,
    [SNAPSHOT_PURGE_AGE_SEC]
  );
  console.log(`[cron] Purged ${snapshots.rowCount} old snapshots (>${SNAPSHOT_PURGE_AGE_SEC / 86400}d)`);

  // Re-enable the trigger after bulk operations
  await db.query('ALTER TABLE queue_entries ENABLE TRIGGER queue_entries_change');

  // 6. Rotate daily hash salt — atomic write with old salt preserved for overlap
  const today = new Date().toISOString().slice(0, 10);
  const currentSalt = await redis.get('daily_salt_date');
  if (currentSalt !== today) {
    const oldSalt = await redis.get('daily_salt');
    const newSalt = randomBytes(32).toString('hex');

    // Atomic update: set new salt + preserve old salt for overlap window
    const pipeline = redis.pipeline();
    pipeline.set('daily_salt_date', today);
    pipeline.set('daily_salt', newSalt);
    // Keep the old salt available for 2 hours so in-flight requests and
    // active cooldowns can still match during the transition
    if (oldSalt) {
      pipeline.set('daily_salt_prev', oldSalt);
      pipeline.expire('daily_salt_prev', 2 * 60 * 60); // 2h overlap
    }
    await pipeline.exec();
    console.log('[cron] Rotated daily hash salt (old salt preserved for 2h overlap)');
  }

  // 7. Refresh analytics materialized view
  try {
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY daily_stats');
    console.log('[cron] Refreshed daily_stats materialized view');
  } catch (err) {
    // View may not exist on first run
    console.log('[cron] Skipped daily_stats refresh (may not exist yet)');
  }

  // 8. Purge old analytics events (>90 days)
  const oldEvents = await db.query(
    `delete from analytics_events where created_at < now() - interval '90 days'`
  );
  if ((oldEvents.rowCount ?? 0) > 0) {
    console.log(`[cron] Purged ${oldEvents.rowCount} old analytics events (>90d)`);
  }

  await db.end();
  await redis.quit();
  console.log('[cron] Done');
  process.exit(0);
}

main().catch((err) => {
  console.error('[cron] Fatal error:', err);
  process.exit(1);
});
