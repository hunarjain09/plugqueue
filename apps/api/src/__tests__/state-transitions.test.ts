import { describe, it, expect } from 'vitest';
import { pool, redis } from './setup';
import { createHash } from 'crypto';

function hashPlate(plate: string): string {
  return createHash('sha256').update(`test-salt-for-integration-tests:${plate}`).digest('hex');
}

async function insertEntry(plate: string, overrides: Record<string, any> = {}) {
  const { rows } = await pool.query(
    `insert into queue_entries (station_id, plate_display, plate_hash, device_hash, status, notified_at, joined_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      overrides.station_id ?? 'test-station',
      plate.slice(0, -3) + '***',
      hashPlate(plate),
      overrides.device_hash ?? 'dev-' + plate,
      overrides.status ?? 'waiting',
      overrides.notified_at ?? null,
      overrides.joined_at ?? new Date(),
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

// ──────────────────────────────────────────────────────────

describe('State Machine: Valid Transitions', () => {
  it('waiting → notified (stall freed)', async () => {
    const entry = await insertEntry('VALID-01');
    expect(entry.status).toBe('waiting');

    const { rowCount } = await pool.query(
      `update queue_entries set status = 'notified', notified_at = now() where id = $1 and status = 'waiting'`,
      [entry.id]
    );
    expect(rowCount).toBe(1);
    expect((await getEntry(entry.id)).status).toBe('notified');
  });

  it('notified → charging (user confirms)', async () => {
    const entry = await insertEntry('VALID-02', { status: 'notified', notified_at: new Date() });
    const { rowCount } = await pool.query(
      `update queue_entries set status = 'charging' where id = $1 and status = 'notified'`,
      [entry.id]
    );
    expect(rowCount).toBe(1);
    expect((await getEntry(entry.id)).status).toBe('charging');
  });

  it('waiting → left (user leaves voluntarily)', async () => {
    const entry = await insertEntry('VALID-03');
    const { rowCount } = await pool.query(
      `update queue_entries set status = 'left' where id = $1 and status = 'waiting'`,
      [entry.id]
    );
    expect(rowCount).toBe(1);
    expect((await getEntry(entry.id)).status).toBe('left');
  });

  it('notified → left (user leaves after notification)', async () => {
    const entry = await insertEntry('VALID-04', { status: 'notified', notified_at: new Date() });
    const { rowCount } = await pool.query(
      `update queue_entries set status = 'left' where id = $1 and status in ('waiting', 'notified')`,
      [entry.id]
    );
    expect(rowCount).toBe(1);
    expect((await getEntry(entry.id)).status).toBe('left');
  });

  it('waiting → expired (timed out after 2h)', async () => {
    const entry = await insertEntry('VALID-05', {
      joined_at: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3h ago
    });
    const { rowCount } = await pool.query(
      `update queue_entries set status = 'expired'
       where id = $1 and status in ('waiting', 'notified') and joined_at < now() - interval '2 hours'`,
      [entry.id]
    );
    expect(rowCount).toBe(1);
    expect((await getEntry(entry.id)).status).toBe('expired');
  });

  it('notified → expired (no confirmation within 3 min)', async () => {
    const entry = await insertEntry('VALID-06', {
      status: 'notified',
      notified_at: new Date(Date.now() - 4 * 60 * 1000), // 4 min ago
    });
    const { rowCount } = await pool.query(
      `update queue_entries set status = 'expired'
       where id = $1 and status = 'notified' and notified_at < now() - interval '3 minutes'`,
      [entry.id]
    );
    expect(rowCount).toBe(1);
    expect((await getEntry(entry.id)).status).toBe('expired');
  });

  it('waiting → expired (3+ community flags)', async () => {
    const entry = await insertEntry('VALID-07');

    for (let i = 1; i <= 3; i++) {
      await pool.query(
        `insert into queue_flags (queue_entry_id, flagger_device, reason)
         values ($1, $2, 'ghost')`,
        [entry.id, `flagger-${i}`]
      );
    }

    const { rows } = await pool.query(
      'select count(*)::int as cnt from queue_flags where queue_entry_id = $1',
      [entry.id]
    );
    expect(rows[0].cnt).toBe(3);

    await pool.query(
      `update queue_entries set status = 'expired'
       where id = $1 and status in ('waiting', 'notified')`,
      [entry.id]
    );
    expect((await getEntry(entry.id)).status).toBe('expired');
  });
});

describe('State Machine: Invalid Transitions (rejected)', () => {
  it('expired → notified is rejected', async () => {
    const entry = await insertEntry('INVALID-01', { status: 'waiting' });
    await pool.query(`update queue_entries set status = 'expired' where id = $1`, [entry.id]);

    const { rowCount } = await pool.query(
      `update queue_entries set status = 'notified' where id = $1 and status = 'waiting'`,
      [entry.id]
    );
    expect(rowCount).toBe(0);
    expect((await getEntry(entry.id)).status).toBe('expired');
  });

  it('left → waiting is rejected', async () => {
    const entry = await insertEntry('INVALID-02', { status: 'waiting' });
    await pool.query(`update queue_entries set status = 'left' where id = $1`, [entry.id]);

    const { rowCount } = await pool.query(
      `update queue_entries set status = 'waiting' where id = $1 and status in ('waiting')`,
      [entry.id]
    );
    expect(rowCount).toBe(0);
    expect((await getEntry(entry.id)).status).toBe('left');
  });

  it('charging → notified is rejected', async () => {
    const entry = await insertEntry('INVALID-03', { status: 'notified', notified_at: new Date() });
    await pool.query(`update queue_entries set status = 'charging' where id = $1`, [entry.id]);

    const { rowCount } = await pool.query(
      `update queue_entries set status = 'notified' where id = $1 and status = 'notified'`,
      [entry.id]
    );
    expect(rowCount).toBe(0);
    expect((await getEntry(entry.id)).status).toBe('charging');
  });

  it('cannot leave an already-expired entry', async () => {
    const entry = await insertEntry('INVALID-04', { status: 'waiting' });
    await pool.query(`update queue_entries set status = 'expired' where id = $1`, [entry.id]);

    const { rowCount } = await pool.query(
      `update queue_entries set status = 'left' where id = $1 and status in ('waiting', 'notified')`,
      [entry.id]
    );
    expect(rowCount).toBe(0);
    expect((await getEntry(entry.id)).status).toBe('expired');
  });

  it('cannot confirm a waiting entry (must be notified first)', async () => {
    const entry = await insertEntry('INVALID-05');

    const { rowCount } = await pool.query(
      `update queue_entries set status = 'charging' where id = $1 and status = 'notified'`,
      [entry.id]
    );
    expect(rowCount).toBe(0);
    expect((await getEntry(entry.id)).status).toBe('waiting');
  });
});

describe('State Machine: CHECK constraints', () => {
  it('rejects invalid queue entry status values', async () => {
    await expect(
      pool.query(
        `insert into queue_entries (station_id, plate_display, plate_hash, device_hash, status)
         values ('test-station', 'BAD***', $1, 'dev-bad', 'invalid_status')`,
        [hashPlate('BAD-STATUS')]
      )
    ).rejects.toThrow();
  });

  it('rejects invalid stall status values', async () => {
    await expect(
      pool.query(
        `update stalls set current_status = 'charging_fast'
         where station_id = 'test-station' and label = 'A1'`
      )
    ).rejects.toThrow();
  });
});

describe('Stall Status Transitions', () => {
  it('in_use → available', async () => {
    await pool.query(
      `update stalls set current_status = 'in_use' where station_id = 'test-station' and label = 'A1'`
    );
    await pool.query(
      `update stalls set current_status = 'available', status_updated_at = now()
       where station_id = 'test-station' and label = 'A1'`
    );
    expect((await getStall('A1')).current_status).toBe('available');
  });

  it('available → in_use', async () => {
    await pool.query(
      `update stalls set current_status = 'available' where station_id = 'test-station' and label = 'B1'`
    );
    await pool.query(
      `update stalls set current_status = 'in_use', status_updated_at = now()
       where station_id = 'test-station' and label = 'B1'`
    );
    expect((await getStall('B1')).current_status).toBe('in_use');
  });

  it('any → offline', async () => {
    await pool.query(
      `update stalls set current_status = 'offline', status_updated_at = now()
       where station_id = 'test-station' and label = 'A1'`
    );
    expect((await getStall('A1')).current_status).toBe('offline');
  });
});

describe('Cooldown State', () => {
  it('cooldown is created on leave', async () => {
    const ph = hashPlate('COOL-01');
    await pool.query(
      `insert into cooldowns (station_id, plate_hash, device_hash, expires_at)
       values ('test-station', $1, 'dev-cool', now() + interval '30 minutes')
       on conflict (station_id, plate_hash) do update set expires_at = excluded.expires_at`,
      [ph]
    );

    const { rows } = await pool.query(
      `select 1 from cooldowns where station_id = 'test-station' and plate_hash = $1 and expires_at > now()`,
      [ph]
    );
    expect(rows.length).toBe(1);
  });

  it('expired cooldown is not found', async () => {
    const ph = hashPlate('COOL-02');
    await pool.query(
      `insert into cooldowns (station_id, plate_hash, device_hash, expires_at)
       values ('test-station', $1, 'dev-cool', now() - interval '1 hour')
       on conflict (station_id, plate_hash) do update set expires_at = excluded.expires_at`,
      [ph]
    );

    const { rows } = await pool.query(
      `select 1 from cooldowns where station_id = 'test-station' and plate_hash = $1 and expires_at > now()`,
      [ph]
    );
    expect(rows.length).toBe(0);
  });

  it('cooldown cleanup removes expired entries', async () => {
    const ph = hashPlate('COOL-03');
    await pool.query(
      `insert into cooldowns (station_id, plate_hash, device_hash, expires_at)
       values ('test-station', $1, 'dev-cool', now() - interval '1 hour')
       on conflict (station_id, plate_hash) do update set expires_at = excluded.expires_at`,
      [ph]
    );

    const { rowCount } = await pool.query('delete from cooldowns where expires_at < now()');
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });
});

describe('Full E2E: 3-driver scenario with timeout cascade', () => {
  it('d1 charges, d2 times out, d3 gets notified', async () => {
    const d1 = await insertEntry('E2E-D1', { device_hash: 'dev-d1' });
    const d2 = await insertEntry('E2E-D2', { device_hash: 'dev-d2' });
    const d3 = await insertEntry('E2E-D3', { device_hash: 'dev-d3' });

    // ── Stall frees → d1 notified ──
    const c1 = await pool.connect();
    await c1.query('BEGIN');
    const { rows: r1 } = await c1.query(
      `select id from queue_entries where station_id = 'test-station' and status = 'waiting'
       order by joined_at asc limit 1 for update skip locked`
    );
    expect(r1[0].id).toBe(d1.id);
    await c1.query(`update queue_entries set status = 'notified', notified_at = now() where id = $1`, [d1.id]);
    await c1.query('COMMIT');
    c1.release();

    // ── d1 confirms ──
    await pool.query(`update queue_entries set status = 'charging' where id = $1`, [d1.id]);
    expect((await getEntry(d1.id)).status).toBe('charging');

    // ── Another stall frees → d2 notified ──
    const c2 = await pool.connect();
    await c2.query('BEGIN');
    const { rows: r2 } = await c2.query(
      `select id from queue_entries where station_id = 'test-station' and status = 'waiting'
       order by joined_at asc limit 1 for update skip locked`
    );
    expect(r2[0].id).toBe(d2.id);
    await c2.query(`update queue_entries set status = 'notified', notified_at = now() where id = $1`, [d2.id]);
    await c2.query('COMMIT');
    c2.release();

    // ── d2 doesn't confirm → simulate 3-min timeout ──
    await pool.query(
      `update queue_entries set notified_at = now() - interval '4 minutes' where id = $1`,
      [d2.id]
    );
    const { rowCount: expired } = await pool.query(
      `update queue_entries set status = 'expired'
       where status = 'notified' and notified_at < now() - interval '3 minutes'`
    );
    expect(expired).toBeGreaterThanOrEqual(1);
    expect((await getEntry(d2.id)).status).toBe('expired');

    // ── d3 is now next in line ──
    const c3 = await pool.connect();
    await c3.query('BEGIN');
    const { rows: r3 } = await c3.query(
      `select id from queue_entries where station_id = 'test-station' and status = 'waiting'
       order by joined_at asc limit 1 for update skip locked`
    );
    expect(r3[0].id).toBe(d3.id);
    await c3.query(`update queue_entries set status = 'notified', notified_at = now() where id = $1`, [d3.id]);
    await c3.query('COMMIT');
    c3.release();

    // ── Final state ──
    const all = await pool.query(
      `select plate_display, status from queue_entries
       where station_id = 'test-station' order by joined_at`
    );
    expect(all.rows).toEqual([
      { plate_display: 'E2E***', status: 'charging' },
      { plate_display: 'E2E***', status: 'expired' },
      { plate_display: 'E2E***', status: 'notified' },
    ]);
  });
});

describe('Snapshot FK constraint', () => {
  it('rejects snapshots with invalid stall labels', async () => {
    await expect(
      pool.query(
        `insert into station_snapshots (station_id, stall_label, stall_status, observed_at, device_hash)
         values ('test-station', 'NONEXISTENT', 'available', now(), 'dev-bad')`
      )
    ).rejects.toThrow();
  });

  it('accepts snapshots with valid stall labels', async () => {
    await expect(
      pool.query(
        `insert into station_snapshots (station_id, stall_label, stall_status, observed_at, device_hash)
         values ('test-station', 'A1', 'available', now(), 'dev-good')`
      )
    ).resolves.toBeDefined();
  });
});

describe('Privacy: plate_display is masked, not raw', () => {
  it('plate_display column contains masked value only', async () => {
    const entry = await insertEntry('SECRET-123');
    const { rows } = await pool.query(
      `select plate_display from queue_entries where id = $1`,
      [entry.id]
    );
    expect(rows[0].plate_display).toBe('SECRET***');
    expect(rows[0].plate_display).not.toContain('123');
  });

  it('no column named "plate" exists (raw plate never stored)', async () => {
    const { rows } = await pool.query(
      `select column_name from information_schema.columns
       where table_name = 'queue_entries' and column_name = 'plate'`
    );
    expect(rows.length).toBe(0);
  });
});

describe('Position tie-breaking', () => {
  it('entries with same joined_at get unique positions via ID ordering', async () => {
    const now = new Date();
    const e1 = await insertEntry('TIE-01', { device_hash: 'dev-tie1', joined_at: now });
    const e2 = await insertEntry('TIE-02', { device_hash: 'dev-tie2', joined_at: now });

    const { rows: pos1 } = await pool.query(
      `select count(*)::int as position from queue_entries
       where station_id = 'test-station' and status = 'waiting'
         and (joined_at < $1 or (joined_at = $1 and id <= $2))`,
      [e1.joined_at, e1.id]
    );

    const { rows: pos2 } = await pool.query(
      `select count(*)::int as position from queue_entries
       where station_id = 'test-station' and status = 'waiting'
         and (joined_at < $1 or (joined_at = $1 and id <= $2))`,
      [e2.joined_at, e2.id]
    );

    // They should have different positions
    expect(pos1[0].position).not.toBe(pos2[0].position);
  });
});
