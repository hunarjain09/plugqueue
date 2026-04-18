import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from './setup';

// Create telemetry tables for tests
beforeAll(async () => {
  await pool.query(`
    create table if not exists analytics_events (
      id uuid primary key default uuid_generate_v4(),
      device_hash text not null,
      session_id text not null,
      event_type text not null,
      event_name text not null,
      station_id text,
      page text,
      properties jsonb not null default '{}',
      created_at timestamptz not null default now(),
      client_ts timestamptz
    )
  `);

  await pool.query(`
    create table if not exists feedback (
      id uuid primary key default uuid_generate_v4(),
      device_hash text not null,
      session_id text not null,
      station_id text,
      rating int check (rating between 1 and 5),
      category text not null default 'general',
      comment text,
      page text,
      created_at timestamptz not null default now()
    )
  `);

  // Clean before tests
  await pool.query('delete from analytics_events');
  await pool.query('delete from feedback');
});

describe('Telemetry: Event Ingestion', () => {
  it('inserts a single event', async () => {
    await pool.query(
      `insert into analytics_events (device_hash, session_id, event_type, event_name, page)
       values ('dev-tel-1', 'sess-1', 'page_view', 'discover', 'discover')`
    );

    const { rows } = await pool.query(
      `select * from analytics_events where device_hash = 'dev-tel-1'`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe('page_view');
    expect(rows[0].event_name).toBe('discover');
  });

  it('inserts a batch of events', async () => {
    const events = [
      ['dev-tel-2', 'sess-2', 'page_view', 'station', 'test-station', 'station'],
      ['dev-tel-2', 'sess-2', 'interaction', 'join_button_click', 'test-station', 'station'],
      ['dev-tel-2', 'sess-2', 'flow_step', 'join_start', 'test-station', 'join'],
    ];

    const values = events.map(
      (e, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
    ).join(', ');

    await pool.query(
      `insert into analytics_events (device_hash, session_id, event_type, event_name, station_id, page)
       values ${values}`,
      events.flat()
    );

    const { rows } = await pool.query(
      `select count(*)::int as cnt from analytics_events where session_id = 'sess-2'`
    );
    expect(rows[0].cnt).toBe(3);
  });

  it('stores properties as JSONB', async () => {
    await pool.query(
      `insert into analytics_events (device_hash, session_id, event_type, event_name, properties)
       values ('dev-tel-3', 'sess-3', 'performance', 'ocr_duration', $1)`,
      [JSON.stringify({ duration_ms: 2340, plate_detected: true })]
    );

    const { rows } = await pool.query(
      `select properties from analytics_events where session_id = 'sess-3'`
    );
    expect(rows[0].properties.duration_ms).toBe(2340);
    expect(rows[0].properties.plate_detected).toBe(true);
  });

  it('stores client-side timestamp', async () => {
    const clientTs = '2026-04-12T15:30:00.000Z';
    await pool.query(
      `insert into analytics_events (device_hash, session_id, event_type, event_name, client_ts)
       values ('dev-tel-4', 'sess-4', 'page_view', 'discover', $1)`,
      [clientTs]
    );

    const { rows } = await pool.query(
      `select client_ts from analytics_events where session_id = 'sess-4'`
    );
    expect(new Date(rows[0].client_ts).toISOString()).toBe(clientTs);
  });
});

describe('Telemetry: Feedback', () => {
  it('inserts feedback with rating and comment', async () => {
    await pool.query(
      `insert into feedback (device_hash, session_id, rating, category, comment, station_id, page)
       values ('dev-fb-1', 'sess-fb-1', 4, 'join_flow', 'OCR was fast!', 'test-station', 'join')`
    );

    const { rows } = await pool.query(
      `select * from feedback where device_hash = 'dev-fb-1'`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].rating).toBe(4);
    expect(rows[0].category).toBe('join_flow');
    expect(rows[0].comment).toBe('OCR was fast!');
  });

  it('feedback without rating is allowed', async () => {
    await pool.query(
      `insert into feedback (device_hash, session_id, category, comment)
       values ('dev-fb-2', 'sess-fb-2', 'bug_report', 'Camera did not open')`
    );

    const { rows } = await pool.query(
      `select * from feedback where device_hash = 'dev-fb-2'`
    );
    expect(rows[0].rating).toBeNull();
    expect(rows[0].comment).toBe('Camera did not open');
  });

  it('rejects invalid rating values', async () => {
    await expect(
      pool.query(
        `insert into feedback (device_hash, session_id, rating, category)
         values ('dev-fb-3', 'sess-fb-3', 6, 'general')`
      )
    ).rejects.toThrow();
  });
});

describe('Telemetry: Join Queue Funnel Tracking', () => {
  it('tracks complete join funnel through events', async () => {
    const sessionId = 'sess-funnel-1';
    const deviceHash = 'dev-funnel-1';
    const stationId = 'test-station';

    // Simulate the full join flow
    const funnelEvents = [
      { type: 'flow_step', name: 'join_start' },
      { type: 'flow_step', name: 'plate_captured' },
      { type: 'flow_step', name: 'spot_selected' },
      { type: 'flow_step', name: 'join_confirmed' },
      { type: 'flow_complete', name: 'join_success' },
    ];

    for (const event of funnelEvents) {
      await pool.query(
        `insert into analytics_events (device_hash, session_id, event_type, event_name, station_id, page)
         values ($1, $2, $3, $4, $5, 'join')`,
        [deviceHash, sessionId, event.type, event.name, stationId]
      );
    }

    // Verify all steps recorded
    const { rows } = await pool.query(
      `select event_name from analytics_events
       where session_id = $1 and event_type in ('flow_step', 'flow_complete')
       order by created_at`,
      [sessionId]
    );

    expect(rows.map((r: any) => r.event_name)).toEqual([
      'join_start', 'plate_captured', 'spot_selected', 'join_confirmed', 'join_success'
    ]);
  });

  it('tracks abandoned funnel (user drops at spot selection)', async () => {
    const sessionId = 'sess-funnel-2';
    const deviceHash = 'dev-funnel-2';

    const events = [
      { type: 'flow_step', name: 'join_start' },
      { type: 'flow_step', name: 'plate_captured' },
      // User leaves here — no spot_selected, no confirm, no success
      { type: 'flow_abandon', name: 'join_abandoned' },
    ];

    for (const event of events) {
      await pool.query(
        `insert into analytics_events (device_hash, session_id, event_type, event_name, station_id)
         values ($1, $2, $3, $4, 'test-station')`,
        [deviceHash, sessionId, event.type, event.name]
      );
    }

    // Verify abandon recorded
    const { rows } = await pool.query(
      `select event_type, event_name from analytics_events
       where session_id = $1 order by created_at`,
      [sessionId]
    );

    expect(rows[2].event_type).toBe('flow_abandon');
    expect(rows[2].event_name).toBe('join_abandoned');
  });
});

describe('Telemetry: Error Tracking', () => {
  it('records client errors with context', async () => {
    await pool.query(
      `insert into analytics_events (device_hash, session_id, event_type, event_name, page, properties)
       values ('dev-err-1', 'sess-err-1', 'error', 'uncaught_error', 'join', $1)`,
      [JSON.stringify({ message: 'TypeError: Cannot read properties of null', filename: 'JoinQueueView.vue', lineno: 42 })]
    );

    const { rows } = await pool.query(
      `select * from analytics_events where event_type = 'error' and session_id = 'sess-err-1'`
    );
    expect(rows[0].event_name).toBe('uncaught_error');
    expect(rows[0].properties.message).toContain('TypeError');
    expect(rows[0].page).toBe('join');
  });
});

describe('Telemetry: Page View & Engagement Queries', () => {
  it('counts unique devices per page', async () => {
    // 3 page views from 2 devices
    await pool.query(`
      insert into analytics_events (device_hash, session_id, event_type, event_name, page) values
        ('dev-pv-1', 'sess-pv-1', 'page_view', 'discover', 'discover'),
        ('dev-pv-1', 'sess-pv-1', 'page_view', 'station', 'station'),
        ('dev-pv-2', 'sess-pv-2', 'page_view', 'discover', 'discover')
    `);

    const { rows } = await pool.query(`
      select page, count(distinct device_hash)::int as unique_devices
      from analytics_events
      where event_type = 'page_view' and page = 'discover'
        and device_hash in ('dev-pv-1', 'dev-pv-2')
      group by page
    `);

    expect(rows[0].unique_devices).toBe(2);
  });

  it('exit page detection works', async () => {
    // Session where user views discover → station → leaves (station is exit page)
    const sid = 'sess-exit-1';
    await pool.query(`
      insert into analytics_events (device_hash, session_id, event_type, event_name, page, created_at) values
        ('dev-exit-1', $1, 'page_view', 'discover', 'discover', now() - interval '5 minutes'),
        ('dev-exit-1', $1, 'page_view', 'station', 'station', now() - interval '3 minutes')
    `, [sid]);

    const { rows } = await pool.query(`
      with session_pages as (
        select session_id, page,
          lead(page) over (partition by session_id order by created_at) as next_page
        from analytics_events
        where event_type = 'page_view' and session_id = $1
      )
      select page, (next_page is null) as is_exit
      from session_pages
      order by page
    `, [sid]);

    const exitPage = rows.find((r: any) => r.is_exit);
    expect(exitPage.page).toBe('station');
  });
});

describe('Telemetry: Feature Usage Tracking', () => {
  it('tracks OCR feature usage with duration', async () => {
    await pool.query(
      `insert into analytics_events (device_hash, session_id, event_type, event_name, station_id, properties)
       values ('dev-feat-1', 'sess-feat-1', 'feature_use', 'camera_ocr', 'test-station', $1)`,
      [JSON.stringify({ duration_ms: 3200, confidence: 0.95, plate_detected: true })]
    );

    const { rows } = await pool.query(
      `select properties from analytics_events where event_name = 'camera_ocr' and session_id = 'sess-feat-1'`
    );
    expect(rows[0].properties.duration_ms).toBe(3200);
  });
});
