-- PlugQueue: Initial schema
-- Requires PostGIS-enabled Postgres 16

create extension if not exists "uuid-ossp";
create extension if not exists "postgis";

-- Stations
create table stations (
  id              text primary key,
  name            text not null,
  provider        text not null,
  address         text,
  location        geography(point, 4326) not null,
  geofence_m      int not null default 300,
  waiting_zone    geography(polygon, 4326),
  indoor          boolean not null default false,
  lot_map_url     text,
  created_at      timestamptz not null default now()
);

create index stations_location_idx on stations using gist(location);

-- Stalls
create table stalls (
  id              uuid primary key default uuid_generate_v4(),
  station_id      text not null references stations(id) on delete cascade,
  label           text not null,
  connector_type  text not null,
  max_kw          int not null,
  location        geography(point, 4326),
  current_status  text not null default 'unknown'
    check (current_status in ('available', 'in_use', 'offline', 'unknown')),
  status_updated_at timestamptz,
  unique (station_id, label)
);

create index stalls_station_idx on stalls(station_id);

-- Queue entries
create table queue_entries (
  id              uuid primary key default uuid_generate_v4(),
  station_id      text not null references stations(id) on delete cascade,
  plate_display   text not null,
  plate_hash      text not null,
  spot_id         text,
  device_hash     text not null,
  joined_at       timestamptz not null default now(),
  status          text not null default 'waiting'
    check (status in ('waiting', 'notified', 'charging', 'expired', 'left')),
  notified_at     timestamptz,
  push_sub_id     text,
  unique (station_id, plate_hash)
);

create index queue_entries_station_status_idx
  on queue_entries(station_id, status, joined_at);

-- Partial indexes for cron/timer queries that don't filter by station_id
create index queue_entries_notified_idx
  on queue_entries(status, notified_at) where status = 'notified';
create index queue_entries_status_joined_idx
  on queue_entries(status, joined_at);

-- Station snapshots (crowdsourced status updates)
create table station_snapshots (
  id              uuid primary key default uuid_generate_v4(),
  station_id      text not null references stations(id) on delete cascade,
  stall_label     text not null,
  stall_status    text not null
    check (stall_status in ('available', 'in_use', 'offline', 'unknown')),
  observed_at     timestamptz not null,
  submitted_at    timestamptz not null default now(),
  device_hash     text not null,
  -- FK to stalls: prevents typo/stale stall labels
  foreign key (station_id, stall_label) references stalls(station_id, label)
    on update cascade on delete cascade
);

create index snapshots_station_time_idx
  on station_snapshots(station_id, observed_at desc);

-- Session stats (voluntary charging session data)
create table session_stats (
  id              uuid primary key default uuid_generate_v4(),
  station_id      text not null references stations(id) on delete cascade,
  session_id      text not null,
  provider        text not null,
  duration_sec    int not null,
  energy_kwh      numeric(6,2) not null,
  cost_usd        numeric(6,2),
  connector_type  text not null,
  max_kw_observed int,
  device_hash     text not null default '',
  submitted_at    timestamptz not null default now(),
  -- Scoped to station+provider+session to prevent cross-station collision attacks
  unique (station_id, provider, session_id)
);

create index session_stats_station_idx on session_stats(station_id);

-- Cooldowns (anti-abuse)
create table cooldowns (
  id              uuid primary key default uuid_generate_v4(),
  station_id      text not null references stations(id) on delete cascade,
  plate_hash      text not null,
  device_hash     text not null,
  expires_at      timestamptz not null,
  unique (station_id, plate_hash)
);

create index cooldowns_expiry_idx on cooldowns(expires_at);

-- Queue flags (community moderation)
create table queue_flags (
  id              uuid primary key default uuid_generate_v4(),
  queue_entry_id  uuid not null references queue_entries(id) on delete cascade,
  flagger_device  text not null,
  reason          text,
  created_at      timestamptz not null default now(),
  unique (queue_entry_id, flagger_device)
);

-- Push subscriptions
create table push_subscriptions (
  id              text primary key,
  endpoint        text not null,
  p256dh          text not null,
  auth            text not null,
  device_hash     text not null,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz
);
