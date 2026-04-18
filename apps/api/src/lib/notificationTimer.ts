import { pool } from './db.js';
import { sendPushNotification } from './push.js';
import {
  NOTIFICATION_CONFIRM_WINDOW_SEC,
  NOTIFICATION_REMINDER_SEC,
  NOTIFICATION_TIMER_INTERVAL_MS,
} from '@plugqueue/shared';
import pino from 'pino';

const logger = pino({ name: 'notification-timer' });

// Track which entries have received a reminder — Map<entryId, timestamp>
// Entries are evicted when they expire or after CONFIRM_WINDOW + buffer
const remindedEntries = new Map<string, number>();

export function startNotificationTimer() {
  async function tick() {
    try {
      // ── 1. Send "Are you plugged in?" reminder ──────────
      // Entries notified > REMINDER_SEC ago that haven't been reminded yet
      const { rows: reminderCandidates } = await pool.query(
        `select id, push_sub_id, station_id
         from queue_entries
         where status = 'notified'
           and notified_at < now() - interval '1 second' * $1
           and notified_at >= now() - interval '1 second' * $2`,
        [NOTIFICATION_REMINDER_SEC, NOTIFICATION_CONFIRM_WINDOW_SEC]
      );

      for (const entry of reminderCandidates) {
        if (remindedEntries.has(entry.id)) continue;
        remindedEntries.set(entry.id, Date.now());

        if (entry.push_sub_id) {
          const timeLeft = NOTIFICATION_CONFIRM_WINDOW_SEC - NOTIFICATION_REMINDER_SEC;
          await sendPushNotification(entry.push_sub_id, {
            title: 'Are you plugged in?',
            body: `Confirm now or your spot will be given to the next driver in ${timeLeft} seconds.`,
            url: `${process.env.WEB_URL ?? 'https://plugqueue.app'}/s/${entry.station_id}/notify`,
            tag: `reminder-${entry.id}`,
          });
          logger.info({ entryId: entry.id }, 'Sent confirmation reminder');
        }
      }

      // ── 2. Expire entries past the confirm window ───────
      const { rows: expired } = await pool.query(
        `update queue_entries
         set status = 'expired'
         where status = 'notified'
           and notified_at < now() - interval '1 second' * $1
         returning id, station_id, push_sub_id`,
        [NOTIFICATION_CONFIRM_WINDOW_SEC]
      );

      if (expired.length > 0) {
        const stationIds = [...new Set(expired.map((r) => r.station_id))];
        logger.info(
          { count: expired.length, stations: stationIds },
          'Expired unconfirmed notifications'
        );

        // Notify the expired user that their spot was given away
        for (const entry of expired) {
          remindedEntries.delete(entry.id);

          if (entry.push_sub_id) {
            await sendPushNotification(entry.push_sub_id, {
              title: 'Spot given to next driver',
              body: `You didn't confirm within ${NOTIFICATION_CONFIRM_WINDOW_SEC / 60} minutes. The next person in queue has been notified.`,
              tag: `expired-${entry.id}`,
            });
          }
        }

        // Advance queue for each affected station
        for (const stationId of stationIds) {
          const { rows } = await pool.query(
            `select exists(
              select 1 from stalls where station_id = $1 and current_status = 'available'
            ) as has_stall,
            exists(
              select 1 from queue_entries where station_id = $1 and status = 'waiting'
            ) as has_waiting`,
            [stationId]
          );

          if (rows[0].has_stall && rows[0].has_waiting) {
            await pool.query(
              `select pg_notify('stall_changed', $1)`,
              [
                JSON.stringify({
                  station_id: stationId,
                  stall_label: 'timer',
                  old_status: 'notified_expired',
                  new_status: 'available',
                  changed_at: new Date().toISOString(),
                }),
              ]
            );
          }
        }
      }

      // ── 3. Evict stale entries from remindedEntries ──
      // Remove entries older than confirm window + 60s buffer
      const evictBefore = Date.now() - (NOTIFICATION_CONFIRM_WINDOW_SEC + 60) * 1000;
      for (const [id, ts] of remindedEntries) {
        if (ts < evictBefore) remindedEntries.delete(id);
      }
    } catch (err) {
      logger.error(err, 'Notification timer tick failed');
    }
  }

  const timer = setInterval(tick, NOTIFICATION_TIMER_INTERVAL_MS);
  tick();
  logger.info(
    `Notification timer started: remind at ${NOTIFICATION_REMINDER_SEC}s, expire at ${NOTIFICATION_CONFIRM_WINDOW_SEC}s, check every ${NOTIFICATION_TIMER_INTERVAL_MS / 1000}s`
  );
  return timer;
}
