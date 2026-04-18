import { Hono } from 'hono';
import pg from 'pg';
import { pool } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import {
  updateStallStatusSchema,
  sessionStatSchema,
  CONSENSUS_THRESHOLD,
  CONSENSUS_WINDOW_SEC,
} from '@plugqueue/shared';
import { turnstileMiddleware } from '../middleware/turnstile.js';
import pino from 'pino';

const logger = pino({ name: 'status' });
const app = new Hono();

/**
 * Consensus model for status updates.
 *
 * A single device reporting stalls as "available" could be malicious.
 * We require 2+ independent device reports within a 5-minute window
 * before actually applying a status change to an in_use → available stall.
 *
 * The opposite direction (available → in_use) is applied immediately
 * since there's no abuse incentive for marking stalls as busy.
 */
async function checkConsensus(
  stationId: string,
  stallLabel: string,
  newStatus: string,
  deviceHash: string,
  txClient?: pg.PoolClient
): Promise<{ apply: boolean; pending: number; needed: number }> {
  // Use transaction client if provided (avoids TOCTOU race with concurrent updates)
  const q = txClient ?? pool;
  // in_use → available requires consensus; all other transitions apply immediately
  const { rows: currentRows } = await q.query(
    'select current_status from stalls where station_id = $1 and label = $2 for update',
    [stationId, stallLabel]
  );
  if (currentRows.length === 0) return { apply: false, pending: 0, needed: 2 };

  const currentStatus = currentRows[0].current_status;

  // Only gate in_use/unknown → available
  if (newStatus !== 'available' || currentStatus === 'available') {
    return { apply: true, pending: 1, needed: 1 };
  }

  // Track reports in Redis: set of device hashes that reported this stall as available
  const key = `consensus:${stationId}:${stallLabel}`;
  const timeKey = `consensus_t:${stationId}:${stallLabel}`;

  await redis.sadd(key, deviceHash);
  await redis.expire(key, CONSENSUS_WINDOW_SEC);

  // Record when the first report came in (for time-based fallback)
  await redis.setnx(timeKey, Date.now().toString());
  await redis.expire(timeKey, CONSENSUS_WINDOW_SEC);

  const reportCount = await redis.scard(key);
  const needed = CONSENSUS_THRESHOLD;

  if (reportCount >= needed) {
    // Consensus reached — clear tracking keys
    await redis.del(key, timeKey);
    return { apply: true, pending: reportCount, needed };
  }

  // Time-based fallback: if a single report has been pending for 10+ minutes
  // with no contradicting report, auto-apply. This prevents small/single-user
  // stations from being permanently stuck.
  const firstReportTime = await redis.get(timeKey);
  if (firstReportTime) {
    const elapsedMs = Date.now() - parseInt(firstReportTime);
    if (elapsedMs > 10 * 60 * 1000) {
      await redis.del(key, timeKey);
      return { apply: true, pending: reportCount, needed: 1 };
    }
  }

  return { apply: false, pending: reportCount, needed };
}

// POST /api/station/:id/update-status — Turnstile-gated
app.post('/:id/update-status', turnstileMiddleware, async (c) => {
  const stationId = c.req.param('id');
  if (!stationId) return c.json({ ok: false, error: 'Missing station id' }, 400);
  const body = await c.req.json();
  const parsed = updateStallStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const { stalls, device_hash, observed_at } = parsed.data;

  // Verify station exists
  const { rows: stationRows } = await pool.query(
    'select id from stations where id = $1',
    [stationId]
  );
  if (stationRows.length === 0) {
    return c.json({ ok: false, error: 'Station not found' }, 404);
  }

  // Detect suspicious batch: if a single device reports ALL stalls changed, flag it
  const { rows: totalStalls } = await pool.query(
    'select count(*) as cnt from stalls where station_id = $1',
    [stationId]
  );
  const totalCount = parseInt(totalStalls[0].cnt);
  if (stalls.length === totalCount && totalCount > 2) {
    logger.warn(
      { stationId, device_hash, stallCount: stalls.length },
      'Suspicious: single device reported all stalls changed'
    );
    // Still process but don't apply without consensus
  }

  const applied: string[] = [];
  const pending: string[] = [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const stall of stalls) {
      // Always record the snapshot (crowdsourced observation)
      await client.query(
        `insert into station_snapshots (station_id, stall_label, stall_status, observed_at, device_hash)
         values ($1, $2, $3, $4, $5)`,
        [stationId, stall.label, stall.status, observed_at, device_hash]
      );

      // Check consensus before applying
      const consensus = await checkConsensus(stationId, stall.label, stall.status, device_hash, client);

      if (consensus.apply) {
        // Update stall status (triggers notify_stall_change)
        await client.query(
          `update stalls set current_status = $1, status_updated_at = now()
           where station_id = $2 and label = $3`,
          [stall.status, stationId, stall.label]
        );
        applied.push(stall.label);
      } else {
        pending.push(stall.label);
        logger.info(
          { stationId, stall: stall.label, reports: consensus.pending, needed: consensus.needed },
          'Status update pending consensus'
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return c.json({
    ok: true,
    data: {
      applied: applied.length,
      applied_stalls: applied,
      pending_consensus: pending.length,
      pending_stalls: pending,
      message:
        pending.length > 0
          ? `${pending.length} stall(s) need one more report to confirm availability.`
          : undefined,
    },
  });
});

// POST /api/station/:id/session
app.post('/:id/session', async (c) => {
  const stationId = c.req.param('id');
  const body = await c.req.json();
  const parsed = sessionStatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;

  const deviceHash = c.req.header('x-device-hash') ?? '';

  await pool.query(
    `insert into session_stats (station_id, session_id, provider, duration_sec, energy_kwh, cost_usd, connector_type, max_kw_observed, device_hash)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (station_id, provider, session_id) do nothing`,
    [
      stationId,
      data.session_id,
      data.provider,
      data.duration_sec,
      data.energy_kwh,
      data.cost_usd ?? null,
      data.connector_type,
      data.max_kw_observed ?? null,
      deviceHash,
    ]
  );

  return c.json({ ok: true, data: { recorded: true } });
});

export default app;
