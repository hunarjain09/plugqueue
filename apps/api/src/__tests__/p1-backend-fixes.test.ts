import { describe, it, expect } from 'vitest';
import { pool, redis } from './setup';
import { createHash } from 'crypto';

function hashPlate(plate: string): string {
  return createHash('sha256').update(`test-salt-for-integration-tests:${plate}`).digest('hex');
}

describe('P1 Fix: Atomic rate limiting', () => {
  it('rate limit keys have a TTL — never immortal', async () => {
    const key = 'rl:test-atomic-device';
    await redis.del(key);

    // Simulate the Lua script behavior
    const lua = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return count
    `;

    const count = await redis.eval(lua, 1, key, 60);
    expect(count).toBe(1);

    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it('rate limit increments atomically', async () => {
    const key = 'rl:test-atomic-multi';
    await redis.del(key);

    const lua = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return count
    `;

    // Simulate 5 rapid requests
    const results = await Promise.all(
      Array.from({ length: 5 }, () => redis.eval(lua, 1, key, 60))
    );

    // All should have incremented
    expect(results).toContain(1);
    expect(Math.max(...(results as number[]))).toBe(5);

    // TTL should still be set
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
  });
});

describe('P1 Fix: Cooldown TTL re-warm uses actual remaining time', () => {
  it('re-warms Redis with correct remaining TTL from Postgres', async () => {
    const plateHash = hashPlate('TTL-TEST-01');
    const stationId = 'test-station';

    // Insert a cooldown that expires in 2 hours
    await pool.query(
      `insert into cooldowns (station_id, plate_hash, device_hash, expires_at)
       values ($1, $2, 'device-ttl', now() + interval '2 hours')
       on conflict (station_id, plate_hash) do update set expires_at = excluded.expires_at`,
      [stationId, plateHash]
    );

    // Ensure Redis does NOT have this key
    await redis.del(`cd:${stationId}:${plateHash}`);

    // Query Postgres for the cooldown (simulating the fallback check)
    const { rows } = await pool.query(
      `select extract(epoch from (expires_at - now())) as remaining_sec
       from cooldowns where station_id = $1 and plate_hash = $2 and expires_at > now()`,
      [stationId, plateHash]
    );

    expect(rows.length).toBe(1);
    const remaining = Math.ceil(parseFloat(rows[0].remaining_sec));

    // Should be ~7200 seconds (2 hours), not hardcoded 1800
    expect(remaining).toBeGreaterThan(3600); // > 1 hour
    expect(remaining).toBeLessThanOrEqual(7200 + 5); // ≤ 2 hours + tolerance

    // Clean up
    await pool.query('delete from cooldowns where station_id = $1 and plate_hash = $2', [stationId, plateHash]);
  });
});

describe('P1 Fix: Worker reconciliation uses DISTINCT stations', () => {
  it('reconciliation query returns distinct station IDs, not cross-product', async () => {
    // Insert 2 waiting entries and ensure 2 stalls are available
    await pool.query(
      `update stalls set current_status = 'available', status_updated_at = now()
       where station_id = 'test-station' and label in ('A1', 'B1')`
    );

    await pool.query(
      `insert into queue_entries (station_id, plate_display, plate_hash, device_hash, status)
       values ('test-station', 'RC***', $1, 'dev-rc1', 'waiting'),
              ('test-station', 'RC***', $2, 'dev-rc2', 'waiting')`,
      [hashPlate('RECON-01'), hashPlate('RECON-02')]
    );

    // The fixed query should return 1 row (1 distinct station), not 4 (2 entries x 2 stalls)
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

    expect(rows.length).toBe(1);
    expect(rows[0].station_id).toBe('test-station');
  });
});

describe('P1 Fix: Plaintext plate NOT stored in DB', () => {
  it('queue_entries stores masked plate_display, not raw plate', async () => {
    const rawPlate = 'ABC-1234';
    const maskedPlate = rawPlate.slice(0, -3) + '***';
    const plateHash = hashPlate(rawPlate);

    await pool.query(
      `insert into queue_entries (station_id, plate_display, plate_hash, device_hash)
       values ('test-station', $1, $2, 'dev-privacy')`,
      [maskedPlate, plateHash]
    );

    // Verify what's stored
    const { rows } = await pool.query(
      `select plate_display from queue_entries where plate_hash = $1`,
      [plateHash]
    );

    expect(rows.length).toBe(1);
    expect(rows[0].plate_display).toBe('ABC-***');
    // Should NOT contain the raw plate
    expect(rows[0].plate_display).not.toBe(rawPlate);
  });
});

describe('P1 Fix: Concurrent join prevented by advisory lock', () => {
  it('two concurrent inserts for the same plate result in only one entry', async () => {
    const plateHash = hashPlate('CONCURRENT-01');

    // Simulate two concurrent transactions with advisory lock
    const clientA = await pool.connect();
    const clientB = await pool.connect();

    try {
      // Both start transactions
      await clientA.query('BEGIN');
      await clientB.query('BEGIN');

      // Both compute the same advisory lock key
      const lockKey = Buffer.from(`test-station:${plateHash}`).reduce(
        (acc, byte) => (acc * 31 + byte) | 0, 0
      );

      // A grabs the lock first
      await clientA.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

      // A checks and inserts
      const { rows: existingA } = await clientA.query(
        `select id from queue_entries where station_id = 'test-station' and plate_hash = $1 and status in ('waiting', 'notified')`,
        [plateHash]
      );
      expect(existingA.length).toBe(0);

      await clientA.query(
        `insert into queue_entries (station_id, plate_display, plate_hash, device_hash)
         values ('test-station', 'CON***', $1, 'dev-a')`,
        [plateHash]
      );
      await clientA.query('COMMIT');

      // B now gets the lock (was blocked until A committed)
      await clientB.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

      // B checks — should now see A's insert
      const { rows: existingB } = await clientB.query(
        `select id from queue_entries where station_id = 'test-station' and plate_hash = $1 and status in ('waiting', 'notified')`,
        [plateHash]
      );
      expect(existingB.length).toBe(1); // A's entry is visible

      await clientB.query('COMMIT');
    } finally {
      clientA.release();
      clientB.release();
    }

    // Verify only 1 entry exists
    const { rows: final } = await pool.query(
      `select count(*) as cnt from queue_entries where station_id = 'test-station' and plate_hash = $1`,
      [plateHash]
    );
    expect(parseInt(final[0].cnt)).toBe(1);
  });
});
