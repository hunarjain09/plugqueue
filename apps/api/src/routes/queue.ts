import { Hono } from 'hono';
import type { AppEnv } from '../env.js';
import { pool } from '../lib/db.js';
import {
  isCooldownMulti,
  setEscalatingCooldown,
  checkMultiDeviceAbuse,
  checkGeoCluster,
} from '../lib/redis.js';
import { hashPlate, hashPlateWithPrevious } from '../lib/hash.js';
import {
  joinQueueSchema,
  leaveQueueSchema,
  confirmChargeSchema,
  flagEntrySchema,
} from '@plugqueue/shared';
import { turnstileMiddleware } from '../middleware/turnstile.js';
import pino from 'pino';

const logger = pino({ name: 'queue' });
const app = new Hono<AppEnv>();

// POST /api/queue/join — Turnstile-gated
app.post('/join', turnstileMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = joinQueueSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const { plate, spot_id, device_hash, push_sub_id, lat, lng } = parsed.data;
  const stationId = c.req.query('station_id');
  if (!stationId) {
    return c.json({ ok: false, error: 'station_id query param required' }, 400);
  }

  // ── Geofence check ──────────────────────────────────────
  const { rows: stationRows } = await pool.query(
    `select id, geofence_m,
            ST_Distance(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance_m
     from stations where id = $3`,
    [lat, lng, stationId]
  );

  if (stationRows.length === 0) {
    return c.json({ ok: false, error: 'Station not found' }, 404);
  }

  const station = stationRows[0];
  // DEV bypass: set DEV_BYPASS_GEOFENCE=true on the api service to skip the
  // distance check so we can exercise the join flow from anywhere. Keep OFF
  // in real production.
  const bypassGeofence = process.env.DEV_BYPASS_GEOFENCE === 'true';
  if (!bypassGeofence && parseFloat(station.distance_m) > station.geofence_m) {
    return c.json(
      {
        ok: false,
        error: `You are ${Math.round(parseFloat(station.distance_m))}m away. Must be within ${station.geofence_m}m.`,
        code: 'OUTSIDE_GEOFENCE',
      },
      403
    );
  }

  const plateHash = await hashPlate(plate);

  // ── Cooldown check — check both current and previous salt hashes ──
  const allHashes = await hashPlateWithPrevious(plate);
  if (await isCooldownMulti(stationId, allHashes)) {
    return c.json(
      { ok: false, error: 'Cooldown active. Try again later.', code: 'COOLDOWN' },
      429
    );
  }

  // ── Multi-device abuse detection ────────────────────────
  const ip = c.get('clientIp') ?? 'unknown';

  const [ipSuspicious, geoSuspicious] = await Promise.all([
    checkMultiDeviceAbuse(ip, plateHash),
    checkGeoCluster(stationId, lat, lng, plateHash),
  ]);

  if (ipSuspicious) {
    logger.warn({ ip, plateHash, stationId }, 'Multi-device abuse: same IP, different plates');
    return c.json(
      {
        ok: false,
        error: 'Suspicious activity detected. Only one vehicle per person, please.',
        code: 'MULTI_DEVICE',
      },
      403
    );
  }

  if (geoSuspicious) {
    logger.warn({ lat, lng, plateHash, stationId }, 'Geo cluster abuse: two joins from same spot');
    // Soft flag — allow but mark for community review
  }

  // ── Atomic duplicate check + insert ──────────────────────
  // Uses a transaction with advisory lock to prevent concurrent duplicate joins.
  // The unique constraint on (station_id, plate_hash) is the final safety net.
  const maskedPlate = plate.length > 3
    ? plate.slice(0, -3) + '***'
    : '***';

  const client = await pool.connect();
  let inserted: any[];
  let position: number;

  try {
    await client.query('BEGIN');

    // Advisory lock keyed on station+plate to serialize concurrent joins
    const lockKey = Buffer.from(`${stationId}:${plateHash}`).reduce(
      (acc, byte) => (acc * 31 + byte) | 0, 0
    );
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

    // Check duplicate inside the transaction
    const { rows: existing } = await client.query(
      `select id from queue_entries
       where station_id = $1 and plate_hash = $2 and status in ('waiting', 'notified')`,
      [stationId, plateHash]
    );

    if (existing.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      return c.json(
        { ok: false, error: 'Already in queue at this station.', code: 'DUPLICATE' },
        409
      );
    }

    // One active entry per device, per station (blocks the "refresh + new plate"
    // abuse vector). Skipped in development so we can exercise the flow locally.
    if (process.env.NODE_ENV !== 'development') {
      const { rows: deviceExisting } = await client.query(
        `select id from queue_entries
         where station_id = $1 and device_hash = $2 and status in ('waiting', 'notified')`,
        [stationId, device_hash]
      );

      if (deviceExisting.length > 0) {
        await client.query('ROLLBACK');
        client.release();
        return c.json(
          {
            ok: false,
            error: 'This device already has an active queue entry at this station.',
            code: 'SAME_DEVICE_ACTIVE',
          },
          409
        );
      }
    }

    const { rows } = await client.query(
      `insert into queue_entries (station_id, plate_display, plate_hash, spot_id, device_hash, push_sub_id)
       values ($1, $2, $3, $4, $5, $6)
       returning id, joined_at, status`,
      [stationId, maskedPlate, plateHash, spot_id ?? null, device_hash, push_sub_id ?? null]
    );
    inserted = rows;

    // Get position inside the same transaction for consistency
    // Use (joined_at, id) for deterministic tie-breaking
    const { rows: posRows } = await client.query(
      `select count(*) as position from queue_entries
       where station_id = $1 and status = 'waiting'
         and (joined_at < $2 or (joined_at = $2 and id <= $3))`,
      [stationId, inserted[0].joined_at, inserted[0].id]
    );
    position = parseInt(posRows[0].position);

    await client.query('COMMIT');
  } catch (err: any) {
    await client.query('ROLLBACK');
    // Unique constraint violation = duplicate (race condition caught by DB)
    if (err.code === '23505') {
      return c.json(
        { ok: false, error: 'Already in queue at this station.', code: 'DUPLICATE' },
        409
      );
    }
    throw err;
  } finally {
    client.release();
  }

  return c.json({
    ok: true,
    data: {
      entry_id: inserted[0].id,
      joined_at: inserted[0].joined_at,
      position,
      plate: maskedPlate,
    },
  });
});

// POST /api/queue/leave — escalating cooldown
app.post('/leave', async (c) => {
  const body = await c.req.json();
  const parsed = leaveQueueSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const { entry_id, device_hash } = parsed.data;

  const { rows } = await pool.query(
    `update queue_entries
     set status = 'left'
     where id = $1 and device_hash = $2 and status in ('waiting', 'notified')
     returning station_id, plate_hash`,
    [entry_id, device_hash]
  );

  if (rows.length === 0) {
    return c.json({ ok: false, error: 'Entry not found or already resolved' }, 404);
  }

  // Escalating cooldown: 30min → 2h → 24h
  const cooldownSec = await setEscalatingCooldown(
    rows[0].station_id,
    rows[0].plate_hash,
    device_hash
  );

  const cooldownMin = Math.round(cooldownSec / 60);
  return c.json({
    ok: true,
    data: { left: true, cooldown_minutes: cooldownMin },
  });
});

// POST /api/queue/confirm
app.post('/confirm', async (c) => {
  const body = await c.req.json();
  const parsed = confirmChargeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const { entry_id, device_hash } = parsed.data;

  const { rows } = await pool.query(
    `update queue_entries
     set status = 'charging'
     where id = $1 and device_hash = $2 and status = 'notified'
     returning id`,
    [entry_id, device_hash]
  );

  if (rows.length === 0) {
    return c.json({ ok: false, error: 'Entry not found or not in notified state' }, 404);
  }

  return c.json({ ok: true, data: { confirmed: true } });
});

// POST /api/queue/flag — Turnstile-gated to prevent mass-flagging abuse
app.post('/flag', turnstileMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = flagEntrySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const { queue_entry_id, flagger_device, reason } = parsed.data;

  await pool.query(
    `insert into queue_flags (queue_entry_id, flagger_device, reason)
     values ($1, $2, $3)
     on conflict (queue_entry_id, flagger_device) do nothing`,
    [queue_entry_id, flagger_device, reason ?? null]
  );

  // Auto-remove if >= 3 flags
  const { rows } = await pool.query(
    'select count(*) as cnt from queue_flags where queue_entry_id = $1',
    [queue_entry_id]
  );

  if (parseInt(rows[0].cnt) >= 3) {
    await pool.query(
      `update queue_entries set status = 'expired' where id = $1 and status in ('waiting', 'notified')`,
      [queue_entry_id]
    );
  }

  return c.json({ ok: true, data: { flagged: true } });
});

export default app;
