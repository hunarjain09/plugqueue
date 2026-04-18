-- PlugQueue: Telemetry & Analytics schema
-- Lightweight, privacy-respecting event tracking

-- Raw event log — every interaction, page view, flow step
create table analytics_events (
  id              uuid primary key default uuid_generate_v4(),
  device_hash     text not null,
  session_id      text not null,
  event_type      text not null,
  event_name      text not null,
  -- Context
  station_id      text,
  page            text,
  -- Flexible payload (click target, error message, flow step, etc.)
  properties      jsonb not null default '{}',
  -- Timing
  created_at      timestamptz not null default now(),
  -- Client-side timestamp (for latency analysis)
  client_ts       timestamptz
);

-- Indexes for common queries
create index events_type_idx on analytics_events(event_type, created_at desc);
create index events_session_idx on analytics_events(session_id, created_at);
create index events_station_idx on analytics_events(station_id, created_at desc) where station_id is not null;
create index events_page_idx on analytics_events(page, created_at desc) where page is not null;
-- Daily rollup queries — cast through UTC so the expression is IMMUTABLE.
-- Plain date_trunc('day', timestamptz) is only STABLE (depends on session TZ).
create index events_daily_idx on analytics_events(((created_at at time zone 'UTC')::date), event_type);

-- Event types:
--   page_view      — user visited a page
--   flow_step      — user completed a step in a flow (join queue funnel, etc.)
--   flow_complete  — user completed an entire flow
--   flow_abandon   — user abandoned a flow mid-way
--   interaction    — user clicked/tapped a specific element
--   error          — an error occurred
--   performance    — timing metric (page load, OCR duration, etc.)
--   feature_use    — user used a specific feature (camera, push, paste, etc.)

-- User feedback — explicit ratings and comments
create table feedback (
  id              uuid primary key default uuid_generate_v4(),
  device_hash     text not null,
  session_id      text not null,
  station_id      text,
  rating          int check (rating between 1 and 5),
  category        text not null default 'general'
    check (category in ('general', 'join_flow', 'queue_experience', 'notification', 'status_update', 'bug_report')),
  comment         text,
  page            text,
  created_at      timestamptz not null default now()
);

create index feedback_station_idx on feedback(station_id, created_at desc) where station_id is not null;
create index feedback_category_idx on feedback(category, created_at desc);

-- Daily aggregates view for dashboarding (materialized for performance)
-- Run REFRESH MATERIALIZED VIEW daily_stats; in cron
create materialized view if not exists daily_stats as
select
  date_trunc('day', created_at)::date as day,
  event_type,
  event_name,
  page,
  station_id,
  count(*) as event_count,
  count(distinct device_hash) as unique_devices,
  count(distinct session_id) as unique_sessions
from analytics_events
group by 1, 2, 3, 4, 5;

create unique index daily_stats_idx on daily_stats(day, event_type, event_name, page, station_id);

-- Funnel view: join queue completion rates
create or replace view join_funnel as
with steps as (
  select
    session_id,
    device_hash,
    date_trunc('day', created_at)::date as day,
    max(case when event_name = 'join_start' then 1 else 0 end) as started,
    max(case when event_name = 'plate_captured' then 1 else 0 end) as plate_done,
    max(case when event_name = 'spot_selected' then 1 else 0 end) as spot_done,
    max(case when event_name = 'join_confirmed' then 1 else 0 end) as confirmed,
    max(case when event_name = 'join_success' then 1 else 0 end) as succeeded
  from analytics_events
  where event_type in ('flow_step', 'flow_complete')
  group by session_id, device_hash, day
)
select
  day,
  count(*) as total_attempts,
  sum(started) as step_1_start,
  sum(plate_done) as step_2_plate,
  sum(spot_done) as step_3_spot,
  sum(confirmed) as step_4_confirm,
  sum(succeeded) as step_5_success,
  round(sum(succeeded)::numeric / nullif(sum(started), 0) * 100, 1) as completion_rate_pct
from steps
group by day
order by day desc;

-- Page engagement view: time spent, bounce rate
create or replace view page_engagement as
select
  page,
  date_trunc('day', created_at)::date as day,
  count(*) filter (where event_type = 'page_view') as views,
  count(distinct device_hash) filter (where event_type = 'page_view') as unique_visitors,
  count(*) filter (where event_type = 'interaction') as interactions,
  -- Bounce = page_view with no subsequent interaction in same session+page
  count(*) filter (where event_type = 'page_view') -
    count(distinct session_id) filter (where event_type = 'interaction') as bounces
from analytics_events
where page is not null
group by page, day
order by day desc, views desc;
