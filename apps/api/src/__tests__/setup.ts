import pg from 'pg';
import Redis from 'ioredis';

/**
 * Integration test setup.
 *
 * Requires a running Postgres (with PostGIS) and Redis.
 * Use docker-compose or local services:
 *
 *   docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=test postgis/postgis:16-3.4
 *   docker run --rm -p 6379:6379 redis:7
 *
 * Then: DATABASE_URL=postgresql://postgres:test@localhost:5432/postgres REDIS_URL=redis://localhost:6379 npx vitest
 */

export let pool: pg.Pool;
export let redis: Redis;

beforeAll(async () => {
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:test@localhost:5432/postgres',
    max: 5,
  });

  redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  // Run migrations inline
  await pool.query(`create extension if not exists "uuid-ossp"`);
  await pool.query(`create extension if not exists "postgis"`);

  // Create tables (idempotent)
  await pool.query(`
    create table if not exists stations (
      id text primary key, name text not null, provider text not null,
      address text, location geography(point, 4326) not null,
      geofence_m int not null default 300, waiting_zone geography(polygon, 4326),
      indoor boolean not null default false, lot_map_url text, created_at timestamptz default now()
    )
  `);
  await pool.query(`
    create table if not exists stalls (
      id uuid primary key default uuid_generate_v4(),
      station_id text not null references stations(id) on delete cascade,
      label text not null, connector_type text not null, max_kw int not null,
      location geography(point, 4326), current_status text not null default 'unknown',
      status_updated_at timestamptz, unique (station_id, label)
    )
  `);
  await pool.query(`
    create table if not exists queue_entries (
      id uuid primary key default uuid_generate_v4(),
      station_id text not null references stations(id) on delete cascade,
      plate text not null, plate_hash text not null, spot_id text,
      device_hash text not null, joined_at timestamptz not null default now(),
      status text not null default 'waiting', notified_at timestamptz, push_sub_id text,
      unique (station_id, plate_hash) deferrable initially deferred
    )
  `);
  await pool.query(`
    create table if not exists cooldowns (
      id uuid primary key default uuid_generate_v4(),
      station_id text not null references stations(id) on delete cascade,
      plate_hash text not null, device_hash text not null,
      expires_at timestamptz not null, unique (station_id, plate_hash)
    )
  `);
  await pool.query(`
    create table if not exists queue_flags (
      id uuid primary key default uuid_generate_v4(),
      queue_entry_id uuid not null references queue_entries(id) on delete cascade,
      flagger_device text not null, reason text, created_at timestamptz default now(),
      unique (queue_entry_id, flagger_device)
    )
  `);
  await pool.query(`
    create table if not exists station_snapshots (
      id uuid primary key default uuid_generate_v4(),
      station_id text not null references stations(id) on delete cascade,
      stall_label text not null, stall_status text not null,
      observed_at timestamptz not null, submitted_at timestamptz not null default now(),
      device_hash text not null
    )
  `);
  await pool.query(`
    create table if not exists push_subscriptions (
      id text primary key, endpoint text not null, p256dh text not null,
      auth text not null, device_hash text not null,
      created_at timestamptz default now(), last_used_at timestamptz
    )
  `);

  // Create triggers (idempotent via OR REPLACE)
  await pool.query(`
    create or replace function notify_stall_change() returns trigger as $$
    begin
      if (old.current_status is distinct from new.current_status) then
        perform pg_notify('stall_changed', json_build_object(
          'station_id', new.station_id, 'stall_label', new.label,
          'old_status', old.current_status, 'new_status', new.current_status, 'changed_at', now()
        )::text);
      end if;
      return new;
    end; $$ language plpgsql
  `);
  await pool.query(`drop trigger if exists stalls_status_change on stalls`);
  await pool.query(`
    create trigger stalls_status_change after update on stalls
    for each row execute function notify_stall_change()
  `);

  await pool.query(`
    create or replace function notify_queue_change() returns trigger as $$
    begin
      perform pg_notify('queue_changed', json_build_object(
        'station_id', coalesce(new.station_id, old.station_id), 'action', tg_op
      )::text);
      return coalesce(new, old);
    end; $$ language plpgsql
  `);
  await pool.query(`drop trigger if exists queue_entries_change on queue_entries`);
  await pool.query(`
    create trigger queue_entries_change after insert or update or delete on queue_entries
    for each row execute function notify_queue_change()
  `);

  // Seed test station
  await pool.query(`
    insert into stations (id, name, provider, address, location, geofence_m)
    values ('test-station', 'Test Station', 'TestProvider', '123 Test St',
            ST_SetSRID(ST_MakePoint(-121.9358, 37.3770), 4326)::geography, 500)
    on conflict (id) do nothing
  `);
  await pool.query(`
    insert into stalls (station_id, label, connector_type, max_kw, current_status) values
      ('test-station', 'A1', 'CCS', 150, 'in_use'),
      ('test-station', 'A2', 'CCS', 150, 'in_use'),
      ('test-station', 'B1', 'CCS', 150, 'available'),
      ('test-station', 'B2', 'CCS', 150, 'in_use')
    on conflict (station_id, label) do update set current_status = excluded.current_status
  `);

  // Set a daily salt for hashing
  await redis.set('daily_salt', 'test-salt-for-integration-tests');
  await redis.set('daily_salt_date', new Date().toISOString().slice(0, 10));
});

beforeEach(async () => {
  // Clean mutable tables before each test
  await pool.query(`delete from queue_flags`);
  await pool.query(`delete from queue_entries`);
  await pool.query(`delete from cooldowns`);
  await pool.query(`delete from station_snapshots`);

  // Reset stall statuses
  await pool.query(`
    update stalls set current_status = 'in_use', status_updated_at = null
    where station_id = 'test-station' and label in ('A1', 'A2', 'B2')
  `);
  await pool.query(`
    update stalls set current_status = 'available', status_updated_at = null
    where station_id = 'test-station' and label = 'B1'
  `);

  // Flush rate limits and cooldowns from Redis
  const keys = await redis.keys('rl:*');
  const cdKeys = await redis.keys('cd:*');
  if (keys.length > 0) await redis.del(...keys);
  if (cdKeys.length > 0) await redis.del(...cdKeys);
});

afterAll(async () => {
  await pool.end();
  await redis.quit();
});
