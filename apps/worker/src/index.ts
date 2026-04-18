import pg from 'pg';
import pino from 'pino';
import { sendPushNotification } from './lib/push.js';

const logger = pino({ name: 'worker' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

async function reconcile() {
  logger.info('Running reconciliation...');
  // Use EXISTS to avoid cross-product duplicates when multiple stalls are available
  const { rows } = await pool.query(`
    select distinct qe.station_id
    from queue_entries qe
    where qe.status = 'waiting'
      and exists (
        select 1 from stalls s
        where s.station_id = qe.station_id
          and s.current_status = 'available'
          and s.status_updated_at > qe.joined_at
      )
  `);

  for (const row of rows) {
    await advanceQueue(row.station_id);
  }

  if (rows.length > 0) {
    logger.info({ stations: rows.length }, 'Reconciliation catch-up complete');
  }
}

async function advanceQueue(stationId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `select id, push_sub_id, plate_hash
       from queue_entries
       where station_id = $1 and status = 'waiting'
       order by joined_at asc
       limit 1
       for update skip locked`,
      [stationId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return;
    }

    const entry = rows[0];

    await client.query(
      `update queue_entries
       set status = 'notified', notified_at = now()
       where id = $1`,
      [entry.id]
    );

    await client.query('COMMIT');

    if (entry.push_sub_id) {
      await sendPushNotification(pool, entry.push_sub_id, {
        title: "It's your turn!",
        body: `A stall just opened. Plug in and confirm within 3 minutes.`,
        url: `${process.env.WEB_URL ?? 'https://plugqueue.app'}/s/${stationId}/notify`,
        tag: `turn-${entry.id}`,
      });
    }

    logger.info({ entryId: entry.id, stationId }, 'Queue advanced, user notified');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(err, 'Failed to advance queue');
  } finally {
    client.release();
  }
}

async function main() {
  let listenClient: pg.Client | null = null;
  let shuttingDown = false;

  async function connectAndListen() {
    listenClient = new pg.Client({
      connectionString: process.env.DATABASE_URL,
    });

    await listenClient.connect();
    logger.info('LISTEN client connected');

    await listenClient.query('LISTEN stall_changed');

    listenClient.on('notification', async (msg) => {
      if (msg.channel !== 'stall_changed' || !msg.payload) return;

      const payload = JSON.parse(msg.payload);
      if (payload.new_status !== 'available') return;

      logger.info(
        { stationId: payload.station_id, stall: payload.stall_label },
        'Stall became available'
      );

      await advanceQueue(payload.station_id);
    });

    listenClient.on('error', async (err) => {
      logger.error(err, 'LISTEN connection lost');
      if (shuttingDown) return;

      // Reconnect with backoff instead of crashing
      listenClient = null;
      let delay = 1000;
      const maxDelay = 30000;

      while (!shuttingDown) {
        logger.info({ delayMs: delay }, 'Reconnecting LISTEN client...');
        await new Promise((r) => setTimeout(r, delay));

        try {
          await connectAndListen();
          // Run reconciliation to catch any events missed during the gap
          await reconcile();
          logger.info('LISTEN reconnected + reconciliation complete');
          return;
        } catch (retryErr) {
          logger.error(retryErr, 'Reconnect failed');
          delay = Math.min(delay * 2, maxDelay);
        }
      }
    });
  }

  await connectAndListen();
  await reconcile();

  // Periodic reconciliation every 5 minutes as a safety net
  setInterval(async () => {
    try {
      await reconcile();
    } catch (err) {
      logger.error(err, 'Periodic reconciliation failed');
    }
  }, 5 * 60 * 1000);

  logger.info('Worker listening for stall_changed events');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    shuttingDown = true;
    logger.info('SIGTERM received, shutting down');
    if (listenClient) await listenClient.end();
    await pool.end();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error(err, 'Fatal worker error');
  process.exit(1);
});
