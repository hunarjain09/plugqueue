import { Hono } from 'hono';
import { pool } from '../lib/db.js';
import { z } from 'zod';
import pino from 'pino';

const logger = pino({ name: 'telemetry' });

const eventSchema = z.object({
  event_type: z.enum([
    'page_view', 'flow_step', 'flow_complete', 'flow_abandon',
    'interaction', 'error', 'performance', 'feature_use',
  ]),
  event_name: z.string().min(1).max(100),
  station_id: z.string().max(100).optional(),
  page: z.string().max(100).optional(),
  properties: z.record(z.unknown()).optional(),
  client_ts: z.string().datetime().optional(),
});

const batchEventSchema = z.object({
  session_id: z.string().min(8).max(64),
  events: z.array(eventSchema).min(1).max(50),
});

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  category: z.enum([
    'general', 'join_flow', 'queue_experience',
    'notification', 'status_update', 'bug_report',
  ]),
  comment: z.string().max(1000).optional(),
  station_id: z.string().max(100).optional(),
  page: z.string().max(100).optional(),
});

const app = new Hono();

// POST /api/telemetry/events — batch event ingestion
app.post('/events', async (c) => {
  const body = await c.req.json();
  const parsed = batchEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: 'Invalid event data' }, 400);
  }

  const deviceHash = c.req.header('x-device-hash') ?? 'unknown';
  const { session_id, events } = parsed.data;

  // Batch insert for efficiency
  const values: any[] = [];
  const placeholders: string[] = [];
  let paramIdx = 1;

  for (const event of events) {
    placeholders.push(
      `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
    );
    values.push(
      deviceHash,
      session_id,
      event.event_type,
      event.event_name,
      event.station_id ?? null,
      event.page ?? null,
      JSON.stringify(event.properties ?? {}),
      event.client_ts ?? null,
    );
  }

  try {
    await pool.query(
      `insert into analytics_events (device_hash, session_id, event_type, event_name, station_id, page, properties, client_ts)
       values ${placeholders.join(', ')}`,
      values
    );
  } catch (err) {
    logger.error(err, 'Failed to insert analytics events');
    // Don't fail the request — telemetry should never break the user experience
    return c.json({ ok: true, data: { recorded: 0 } });
  }

  return c.json({ ok: true, data: { recorded: events.length } });
});

// POST /api/telemetry/feedback
app.post('/feedback', async (c) => {
  const body = await c.req.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: 'Invalid feedback data' }, 400);
  }

  const deviceHash = c.req.header('x-device-hash') ?? 'unknown';
  const sessionId = body.session_id ?? 'unknown';
  const { rating, category, comment, station_id, page } = parsed.data;

  await pool.query(
    `insert into feedback (device_hash, session_id, station_id, rating, category, comment, page)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [deviceHash, sessionId, station_id ?? null, rating ?? null, category, comment ?? null, page ?? null]
  );

  return c.json({ ok: true, data: { submitted: true } });
});

// GET /api/telemetry/stats/daily — dashboard data (protected, add auth later)
app.get('/stats/daily', async (c) => {
  const days = Math.min(parseInt(c.req.query('days') ?? '7'), 90);

  const [overview, funnel, pages, feedback, topStations] = await Promise.all([
    // Overall daily metrics
    pool.query(
      `select
        date_trunc('day', created_at)::date as day,
        count(*) as total_events,
        count(distinct device_hash) as unique_devices,
        count(distinct session_id) as unique_sessions,
        count(*) filter (where event_type = 'page_view') as page_views,
        count(*) filter (where event_type = 'error') as errors,
        count(*) filter (where event_type = 'flow_complete') as completed_flows
      from analytics_events
      where created_at > now() - interval '1 day' * $1
      group by day order by day desc`,
      [days]
    ),

    // Join funnel
    pool.query(
      `select * from join_funnel where day > now()::date - $1 order by day desc`,
      [days]
    ),

    // Page engagement
    pool.query(
      `select * from page_engagement where day > now()::date - $1 order by day desc, views desc`,
      [days]
    ),

    // Feedback summary
    pool.query(
      `select
        category,
        count(*) as count,
        round(avg(rating), 1) as avg_rating,
        count(*) filter (where rating <= 2) as negative,
        count(*) filter (where rating >= 4) as positive
      from feedback
      where created_at > now() - interval '1 day' * $1
      group by category order by count desc`,
      [days]
    ),

    // Most active stations
    pool.query(
      `select
        station_id,
        count(*) as events,
        count(distinct device_hash) as unique_users,
        count(*) filter (where event_name = 'join_success') as successful_joins
      from analytics_events
      where station_id is not null and created_at > now() - interval '1 day' * $1
      group by station_id order by events desc limit 10`,
      [days]
    ),
  ]);

  return c.json({
    ok: true,
    data: {
      overview: overview.rows,
      funnel: funnel.rows,
      pages: pages.rows,
      feedback: feedback.rows,
      top_stations: topStations.rows,
    },
  });
});

// GET /api/telemetry/stats/dropoffs — where users leave
app.get('/stats/dropoffs', async (c) => {
  const days = Math.min(parseInt(c.req.query('days') ?? '7'), 90);

  const { rows } = await pool.query(
    `with session_pages as (
      select
        session_id,
        page,
        event_type,
        created_at,
        lead(page) over (partition by session_id order by created_at) as next_page
      from analytics_events
      where event_type = 'page_view' and page is not null
        and created_at > now() - interval '1 day' * $1
    )
    select
      page as exit_page,
      count(*) filter (where next_page is null) as exits,
      count(*) as total_views,
      round(count(*) filter (where next_page is null)::numeric / count(*) * 100, 1) as exit_rate_pct
    from session_pages
    group by page
    order by exits desc`,
    [days]
  );

  return c.json({ ok: true, data: rows });
});

export default app;
