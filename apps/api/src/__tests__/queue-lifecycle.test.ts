import { describe, it, expect } from 'vitest';
import { pool, redis } from './setup';
import { createHash } from 'crypto';

// ─── Helpers ───────────────────────────────────────────────

function hashPlate(plate: string): string {
  return createHash('sha256').update(`test-salt-for-integration-tests:${plate}`).digest('hex');
}

async function insertQueueEntry(
  plate: string,
  opts: { status?: string; device_hash?: string; spot_id?: string; waiting_spot_id?: string; notified_at?: Date } = {}
) {
  const { rows } = await pool.query(
    `insert into queue_entries (station_id, plate, plate_hash, spot_id, waiting_spot_id, device_hash, status, notified_at)
     values ('test-station', $1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      plate,
      hashPlate(plate),
      opts.spot_id ?? null,
      opts.waiting_spot_id ?? null,
      opts.device_hash ?? 'device-aaa',
      opts.status ?? 'waiting',
      opts.notified_at ?? null,
    ]
  );
  return rows[0];
}

async function getEntry(id: string) {
  const { rows } = await pool.query('select * from queue_entries where id = $1', [id]);
  return rows[0] ?? null;
}

async function getStall(label: string) {
  const { rows } = await pool.query(
    `select * from stalls where station_id = 'test-station' and label = $1`,
    [label]
  );
  return rows[0];
}

// ─── Tests ─────────────────────────────────────────────────

describe('Queue Lifecycle: Join → Wait → Notify → Confirm', () => {
  it('inserts a waiting entry and assigns correct position', async () => {
    const e1 = await insertQueueEntry('ABC-1111');
    const e2 = await insertQueueEntry('DEF-2222', { device_hash: 'device-bbb' });

    expect(e1.status).toBe('waiting');
    expect(e2.status).toBe('waiting');

    // Position: e1 joined first
    const { rows } = await pool.query(
      `select id from queue_entries where station_id = 'test-station' and status = 'waiting' order by joined_at asc`
    );
    expect(rows[0].id).toBe(e1.id);
    expect(rows[1].id).toBe(e2.id);
  });

  it('prevents duplicate plate_hash at same station', async () => {
    await insertQueueEntry('ABC-1111');

    await expect(
      pool.query(
        `insert into queue_entries (station_id, plate, plate_hash, device_hash)
         values ('test-station', 'ABC-1111', $1, 'device-bbb')`,
        [hashPlate('ABC-1111')]
      )
    ).rejects.toThrow();
  });

  it('transitions waiting → notified', async () => {
    const entry = await insertQueueEntry('ABC-1111');

    await pool.query(
      `update queue_entries set status = 'notified', notified_at = now() where id = $1`,
      [entry.id]
    );

    const updated = await getEntry(entry.id);
    expect(updated.status).toBe('notified');
    expect(updated.notified_at).not.toBeNull();
  });

  it('transitions notified → charging (confirm)', async () => {
    const entry = await insertQueueEntry('ABC-1111', { status: 'notified', notified_at: new Date() });

    const { rowCount } = await pool.query(
      `update queue_entries set status = 'charging' where id = $1 and status = 'notified'`,
      [entry.id]
    );

    expect(rowCount).toBe(1);
    const updated = await getEntry(entry.id);
    expect(updated.status).toBe('charging');
  });

  it('full lifecycle: join → notify → confirm', async () => {
    // Join
    const entry = await insertQueueEntry('LIFECYCLE-01');
    expect(entry.status).toBe('waiting');

    // Simulate worker advancing queue (notified)
    await pool.query(
      `update queue_entries set status = 'notified', notified_at = now() where id = $1`,
      [entry.id]
    );
    let e = await getEntry(entry.id);
    expect(e.status).toBe('notified');

    // Confirm charging
    await pool.query(
      `update queue_entries set status = 'charging' where id = $1 and status = 'notified'`,
      [entry.id]
    );
    e = await getEntry(entry.id);
    expect(e.status).toBe('charging');
  });
});

describe('Queue Lifecycle: Leave & Cooldown', () => {
  it('transitions waiting → left and sets cooldown', async () => {
    const entry = await insertQueueEntry('LEAVE-01');

    // Leave queue
    await pool.query(
      `update queue_entries set status = 'left' where id = $1 and status = 'waiting'`,
      [entry.id]
    );
    const updated = await getEntry(entry.id);
    expect(updated.status).toBe('left');

    // Set cooldown in Redis
    await redis.set(`cd:test-station:${hashPlate('LEAVE-01')}`, '1', 'EX', 1800);

    // Set cooldown in Postgres (audit)
    await pool.query(
      `insert into cooldowns (station_id, plate_hash, device_hash, expires_at)
       values ('test-station', $1, 'device-aaa', now() + interval '30 minutes')`,
      [hashPlate('LEAVE-01')]
    );

    // Verify cooldown blocks rejoining
    const cooldownActive = await redis.get(`cd:test-station:${hashPlate('LEAVE-01')}`);
    expect(cooldownActive).toBe('1');
  });

  it('transitions notified → left (driver bails after notification)', async () => {
    const entry = await insertQueueEntry('BAIL-01', { status: 'notified', notified_at: new Date() });

    const { rowCount } = await pool.query(
      `update queue_entries set status = 'left'
       where id = $1 and device_hash = 'device-aaa' and status in ('waiting', 'notified')`,
      [entry.id]
    );
    expect(rowCount).toBe(1);

    const updated = await getEntry(entry.id);
    expect(updated.status).toBe('left');
  });

  it('cannot leave an already-expired entry', async () => {
    const entry = await insertQueueEntry('EXPIRED-01', { status: 'waiting' });

    // Expire it first
    await pool.query(`update queue_entries set status = 'expired' where id = $1`, [entry.id]);

    // Try to leave — should not match
    const { rowCount } = await pool.query(
      `update queue_entries set status = 'left'
       where id = $1 and status in ('waiting', 'notified')`,
      [entry.id]
    );
    expect(rowCount).toBe(0);

    const updated = await getEntry(entry.id);
    expect(updated.status).toBe('expired');
  });
});

describe('Queue Advancement via Stall Status Change', () => {
  it('LISTEN/NOTIFY fires when stall status changes', async () => {
    const client = new (await import('pg')).default.Client({
      connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:test@localhost:5432/postgres',
    });
    await client.connect();
    await client.query('LISTEN stall_changed');

    const notifications: any[] = [];
    client.on('notification', (msg) => {
      if (msg.channel === 'stall_changed') {
        notifications.push(JSON.parse(msg.payload!));
      }
    });

    // Change stall A1 from in_use → available
    await pool.query(
      `update stalls set current_status = 'available', status_updated_at = now()
       where station_id = 'test-station' and label = 'A1'`
    );

    // Wait for notification delivery
    await new Promise((r) => setTimeout(r, 500));

    expect(notifications.length).toBe(1);
    expect(notifications[0].station_id).toBe('test-station');
    expect(notifications[0].stall_label).toBe('A1');
    expect(notifications[0].old_status).toBe('in_use');
    expect(notifications[0].new_status).toBe('available');

    await client.end();
  });

  it('advances the oldest waiting entry with FOR UPDATE SKIP LOCKED', async () => {
    const e1 = await insertQueueEntry('FIRST-01');
    const e2 = await insertQueueEntry('SECOND-02', { device_hash: 'device-bbb' });

    // Simulate worker: pick the first waiting entry
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `select id from queue_entries
         where station_id = 'test-station' and status = 'waiting'
         order by joined_at asc limit 1
         for update skip locked`
      );
      expect(rows.length).toBe(1);
      expect(rows[0].id).toBe(e1.id);

      await client.query(
        `update queue_entries set status = 'notified', notified_at = now() where id = $1`,
        [rows[0].id]
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // e1 is notified, e2 still waiting
    expect((await getEntry(e1.id)).status).toBe('notified');
    expect((await getEntry(e2.id)).status).toBe('waiting');
  });

  it('skips locked rows so parallel workers do not double-notify', async () => {
    const e1 = await insertQueueEntry('PARA-01');
    const e2 = await insertQueueEntry('PARA-02', { device_hash: 'device-bbb' });

    // Worker A grabs e1 and holds the lock
    const clientA = await pool.connect();
    await clientA.query('BEGIN');
    const { rows: rowsA } = await clientA.query(
      `select id from queue_entries
       where station_id = 'test-station' and status = 'waiting'
       order by joined_at asc limit 1
       for update skip locked`
    );
    expect(rowsA[0].id).toBe(e1.id);

    // Worker B runs concurrently — should skip e1 and get e2
    const clientB = await pool.connect();
    await clientB.query('BEGIN');
    const { rows: rowsB } = await clientB.query(
      `select id from queue_entries
       where station_id = 'test-station' and status = 'waiting'
       order by joined_at asc limit 1
       for update skip locked`
    );
    expect(rowsB[0].id).toBe(e2.id);

    await clientA.query('COMMIT');
    await clientB.query('COMMIT');
    clientA.release();
    clientB.release();
  });
});

describe('Community Flagging', () => {
  it('flags accumulate and auto-expire entry at 3 flags', async () => {
    const entry = await insertQueueEntry('GHOST-01');

    // 3 different devices flag this entry
    for (const device of ['flagger-1', 'flagger-2', 'flagger-3']) {
      await pool.query(
        `insert into queue_flags (queue_entry_id, flagger_device, reason)
         values ($1, $2, 'not here')
         on conflict (queue_entry_id, flagger_device) do nothing`,
        [entry.id, device]
      );
    }

    const { rows } = await pool.query(
      'select count(*) as cnt from queue_flags where queue_entry_id = $1',
      [entry.id]
    );
    expect(parseInt(rows[0].cnt)).toBe(3);

    // Auto-expire (simulating API logic)
    if (parseInt(rows[0].cnt) >= 3) {
      await pool.query(
        `update queue_entries set status = 'expired' where id = $1 and status in ('waiting', 'notified')`,
        [entry.id]
      );
    }

    const updated = await getEntry(entry.id);
    expect(updated.status).toBe('expired');
  });

  it('prevents duplicate flags from same device', async () => {
    const entry = await insertQueueEntry('DUP-FLAG-01');

    await pool.query(
      `insert into queue_flags (queue_entry_id, flagger_device, reason) values ($1, 'same-device', 'test')`,
      [entry.id]
    );

    // Same device again — should be a no-op
    await pool.query(
      `insert into queue_flags (queue_entry_id, flagger_device, reason) values ($1, 'same-device', 'test again')
       on conflict (queue_entry_id, flagger_device) do nothing`,
      [entry.id]
    );

    const { rows } = await pool.query(
      'select count(*) as cnt from queue_flags where queue_entry_id = $1',
      [entry.id]
    );
    expect(parseInt(rows[0].cnt)).toBe(1);
  });
});

describe('Station Status Updates', () => {
  it('updates stall status and records snapshot', async () => {
    const before = await getStall('A2');
    expect(before.current_status).toBe('in_use');

    // Simulate community update
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `update stalls set current_status = 'available', status_updated_at = now()
         where station_id = 'test-station' and label = 'A2'`
      );

      await client.query(
        `insert into station_snapshots (station_id, stall_label, stall_status, observed_at, device_hash)
         values ('test-station', 'A2', 'available', now(), 'updater-device')`
      );

      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const after = await getStall('A2');
    expect(after.current_status).toBe('available');
    expect(after.status_updated_at).not.toBeNull();

    const { rows: snapshots } = await pool.query(
      `select * from station_snapshots where station_id = 'test-station' and stall_label = 'A2'`
    );
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].stall_status).toBe('available');
  });

  it('batch updates multiple stalls in a single transaction', async () => {
    const updates = [
      { label: 'A1', status: 'available' },
      { label: 'A2', status: 'available' },
      { label: 'B2', status: 'offline' },
    ];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const u of updates) {
        await client.query(
          `update stalls set current_status = $1, status_updated_at = now()
           where station_id = 'test-station' and label = $2`,
          [u.status, u.label]
        );
      }
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    expect((await getStall('A1')).current_status).toBe('available');
    expect((await getStall('A2')).current_status).toBe('available');
    expect((await getStall('B2')).current_status).toBe('offline');
  });
});

describe('Cron Cleanup Jobs', () => {
  it('expires entries older than 2 hours', async () => {
    // Insert an old entry
    await pool.query(
      `insert into queue_entries (station_id, plate, plate_hash, device_hash, status, joined_at)
       values ('test-station', 'OLD-01', $1, 'device-old', 'waiting', now() - interval '3 hours')`,
      [hashPlate('OLD-01')]
    );

    const { rowCount } = await pool.query(`
      update queue_entries set status = 'expired'
      where status in ('waiting', 'notified')
        and joined_at < now() - interval '2 hours'
    `);
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  it('expires notified entries that did not confirm within 5 min', async () => {
    await pool.query(
      `insert into queue_entries (station_id, plate, plate_hash, device_hash, status, notified_at)
       values ('test-station', 'STALE-01', $1, 'device-stale', 'notified', now() - interval '10 minutes')`,
      [hashPlate('STALE-01')]
    );

    const { rowCount } = await pool.query(`
      update queue_entries set status = 'expired'
      where status = 'notified'
        and notified_at < now() - interval '5 minutes'
    `);
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  it('purges old completed entries (>24h)', async () => {
    await pool.query(
      `insert into queue_entries (station_id, plate, plate_hash, device_hash, status, joined_at)
       values ('test-station', 'PURGE-01', $1, 'device-purge', 'expired', now() - interval '25 hours')`,
      [hashPlate('PURGE-01')]
    );

    const { rowCount } = await pool.query(`
      delete from queue_entries
      where status in ('expired', 'left', 'charging')
        and joined_at < now() - interval '24 hours'
    `);
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  it('cleans expired cooldowns', async () => {
    await pool.query(
      `insert into cooldowns (station_id, plate_hash, device_hash, expires_at)
       values ('test-station', 'expired-plate', 'device-cd', now() - interval '1 hour')`
    );

    const { rowCount } = await pool.query('delete from cooldowns where expires_at < now()');
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });
});

describe('Rate Limiting (Redis)', () => {
  it('allows requests under the limit', async () => {
    const key = 'rl:device-rate-test';
    for (let i = 0; i < 5; i++) {
      await redis.incr(key);
    }
    const count = parseInt((await redis.get(key))!);
    expect(count).toBe(5);
    expect(count).toBeLessThanOrEqual(30);
  });

  it('blocks requests over the limit', async () => {
    const key = 'rl:device-rate-blocked';
    // Simulate 31 requests
    for (let i = 0; i < 31; i++) {
      const c = await redis.incr(key);
      if (c === 1) await redis.expire(key, 60);
    }
    const count = parseInt((await redis.get(key))!);
    expect(count).toBe(31);
    expect(count).toBeGreaterThan(30);
  });
});

describe('Geofence Validation', () => {
  it('accepts a driver within the geofence', async () => {
    // Test station is at -121.9358, 37.3770 with 500m geofence
    // Point ~100m away
    const { rows } = await pool.query(
      `select ST_Distance(location, ST_SetSRID(ST_MakePoint(-121.9350, 37.3775), 4326)::geography) as distance_m,
              geofence_m
       from stations where id = 'test-station'`
    );
    const dist = parseFloat(rows[0].distance_m);
    expect(dist).toBeLessThan(rows[0].geofence_m);
  });

  it('rejects a driver outside the geofence', async () => {
    // Point ~5km away
    const { rows } = await pool.query(
      `select ST_Distance(location, ST_SetSRID(ST_MakePoint(-121.88, 37.40), 4326)::geography) as distance_m,
              geofence_m
       from stations where id = 'test-station'`
    );
    const dist = parseFloat(rows[0].distance_m);
    expect(dist).toBeGreaterThan(rows[0].geofence_m);
  });
});

describe('Full E2E: Stall frees → queue advances → next driver notified', () => {
  it('complete flow with 3 drivers', async () => {
    // 3 drivers join the queue
    const d1 = await insertQueueEntry('FLOW-01', { device_hash: 'dev-1' });
    const d2 = await insertQueueEntry('FLOW-02', { device_hash: 'dev-2' });
    const d3 = await insertQueueEntry('FLOW-03', { device_hash: 'dev-3' });

    // All stalls are in_use initially. Now stall A1 frees up.
    await pool.query(
      `update stalls set current_status = 'available', status_updated_at = now()
       where station_id = 'test-station' and label = 'A1'`
    );

    // Worker picks up d1 (first in queue)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `select id from queue_entries
         where station_id = 'test-station' and status = 'waiting'
         order by joined_at asc limit 1
         for update skip locked`
      );
      expect(rows[0].id).toBe(d1.id);
      await client.query(
        `update queue_entries set status = 'notified', notified_at = now() where id = $1`,
        [d1.id]
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    expect((await getEntry(d1.id)).status).toBe('notified');
    expect((await getEntry(d2.id)).status).toBe('waiting');
    expect((await getEntry(d3.id)).status).toBe('waiting');

    // d1 confirms they're charging
    await pool.query(
      `update queue_entries set status = 'charging' where id = $1 and status = 'notified'`,
      [d1.id]
    );
    expect((await getEntry(d1.id)).status).toBe('charging');

    // Now stall A2 frees up — d2 should be next
    await pool.query(
      `update stalls set current_status = 'available', status_updated_at = now()
       where station_id = 'test-station' and label = 'A2'`
    );

    const client2 = await pool.connect();
    try {
      await client2.query('BEGIN');
      const { rows } = await client2.query(
        `select id from queue_entries
         where station_id = 'test-station' and status = 'waiting'
         order by joined_at asc limit 1
         for update skip locked`
      );
      expect(rows[0].id).toBe(d2.id);
      await client2.query(
        `update queue_entries set status = 'notified', notified_at = now() where id = $1`,
        [d2.id]
      );
      await client2.query('COMMIT');
    } finally {
      client2.release();
    }

    expect((await getEntry(d2.id)).status).toBe('notified');
    expect((await getEntry(d3.id)).status).toBe('waiting');

    // d2 doesn't respond — simulate 5-min timeout (cron job)
    await pool.query(
      `update queue_entries set notified_at = now() - interval '6 minutes' where id = $1`,
      [d2.id]
    );
    await pool.query(`
      update queue_entries set status = 'expired'
      where status = 'notified' and notified_at < now() - interval '5 minutes'
    `);
    expect((await getEntry(d2.id)).status).toBe('expired');

    // Now d3 should be next in line
    const client3 = await pool.connect();
    try {
      await client3.query('BEGIN');
      const { rows } = await client3.query(
        `select id from queue_entries
         where station_id = 'test-station' and status = 'waiting'
         order by joined_at asc limit 1
         for update skip locked`
      );
      expect(rows[0].id).toBe(d3.id);
      await client3.query(
        `update queue_entries set status = 'notified', notified_at = now() where id = $1`,
        [d3.id]
      );
      await client3.query('COMMIT');
    } finally {
      client3.release();
    }

    expect((await getEntry(d3.id)).status).toBe('notified');

    // Final state:
    // d1: charging ✓
    // d2: expired (timed out) ✓
    // d3: notified ✓
    const all = await pool.query(
      `select plate, status from queue_entries where station_id = 'test-station' order by joined_at`
    );
    expect(all.rows.map((r: any) => ({ plate: r.plate, status: r.status }))).toEqual([
      { plate: 'FLOW-01', status: 'charging' },
      { plate: 'FLOW-02', status: 'expired' },
      { plate: 'FLOW-03', status: 'notified' },
    ]);
  });
});
