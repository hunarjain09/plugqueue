import Redis from 'ioredis';
import { pool } from './db.js';
import {
  RATE_LIMIT_DEVICE,
  RATE_LIMIT_IP,
  COOLDOWN_TIERS_SEC,
  DEFAULT_COOLDOWN_SEC,
  MULTI_DEVICE_WINDOW_SEC,
  CONSENSUS_THRESHOLD,
  CONSENSUS_WINDOW_SEC,
} from '@plugqueue/shared';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// ─── Rate Limiting (atomic via Lua) ────────────────────────

// Lua script: atomic INCR + EXPIRE. Returns the count after increment.
// Prevents immortal keys if process crashes between INCR and EXPIRE.
const RATE_LIMIT_LUA = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

async function atomicRateLimit(key: string, limit: number, windowSec: number, errorType: string): Promise<void> {
  const count = await redis.eval(RATE_LIMIT_LUA, 1, key, windowSec) as number;
  if (count > limit) throw new Error(errorType);
}

/** Per-device-hash rate limit */
export async function checkRateLimit(
  deviceHash: string,
  limit = RATE_LIMIT_DEVICE.limit,
  windowSec = RATE_LIMIT_DEVICE.windowSec
): Promise<void> {
  await atomicRateLimit(`rl:${deviceHash}`, limit, windowSec, 'RATE_LIMITED');
}

/** Per-IP rate limit — harder to spoof than device hash */
export async function checkIpRateLimit(
  ip: string,
  limit = RATE_LIMIT_IP.limit,
  windowSec = RATE_LIMIT_IP.windowSec
): Promise<void> {
  await atomicRateLimit(`rl:ip:${ip}`, limit, windowSec, 'IP_RATE_LIMITED');
}

// ─── Cooldowns ─────────────────────────────────────────────

/**
 * Check cooldown: checks both current and previous plate hashes
 * to handle salt rotation overlap. Redis first, Postgres fallback.
 */
export async function isCooldown(stationId: string, plateHash: string): Promise<boolean> {
  return isCooldownSingle(stationId, plateHash);
}

/**
 * Check cooldown against multiple plate hashes (current + previous salt).
 * Call this with the result of hashPlateWithPrevious() during the salt overlap window.
 */
export async function isCooldownMulti(stationId: string, plateHashes: string[]): Promise<boolean> {
  for (const ph of plateHashes) {
    if (await isCooldownSingle(stationId, ph)) return true;
  }
  return false;
}

async function isCooldownSingle(stationId: string, plateHash: string): Promise<boolean> {
  // Fast path: Redis
  const redisCd = await redis.get(`cd:${stationId}:${plateHash}`);
  if (redisCd) return true;

  // Fallback: Postgres (in case Redis was flushed or key evicted)
  const { rows } = await pool.query(
    `select extract(epoch from (expires_at - now())) as remaining_sec
     from cooldowns where station_id = $1 and plate_hash = $2 and expires_at > now()`,
    [stationId, plateHash]
  );
  if (rows.length > 0) {
    // Re-warm Redis with actual remaining TTL (not hardcoded 1800)
    const ttl = Math.max(1, Math.ceil(parseFloat(rows[0].remaining_sec)));
    await redis.set(`cd:${stationId}:${plateHash}`, '1', 'EX', ttl);
    return true;
  }

  return false;
}

export async function setCooldown(
  stationId: string,
  plateHash: string,
  sec = DEFAULT_COOLDOWN_SEC
): Promise<void> {
  await redis.set(`cd:${stationId}:${plateHash}`, '1', 'EX', sec);
}

/**
 * Escalating cooldown: repeated leaves within 24h get longer bans.
 * 1st leave = 30 min, 2nd = 2 hours, 3rd+ = 24 hours.
 */
export async function setEscalatingCooldown(
  stationId: string,
  plateHash: string,
  deviceHash: string
): Promise<number> {
  // Count how many cooldowns this plate has had in the last 24h
  const { rows } = await pool.query(
    `select count(*) as cnt from cooldowns
     where plate_hash = $1 and expires_at > now() - interval '24 hours'`,
    [plateHash]
  );
  const priorCount = parseInt(rows[0].cnt);
  const cooldownSec = COOLDOWN_TIERS_SEC[Math.min(priorCount, COOLDOWN_TIERS_SEC.length - 1)];

  await redis.set(`cd:${stationId}:${plateHash}`, '1', 'EX', cooldownSec);

  // Audit in Postgres
  await pool.query(
    `insert into cooldowns (station_id, plate_hash, device_hash, expires_at)
     values ($1, $2, $3, now() + interval '1 second' * $4)
     on conflict (station_id, plate_hash)
     do update set expires_at = excluded.expires_at, device_hash = excluded.device_hash`,
    [stationId, plateHash, deviceHash, cooldownSec]
  );

  return cooldownSec;
}

// ─── Multi-device Detection ────────────────────────────────

/**
 * Track IP → plates mapping. If the same IP joins with 2+ different
 * plates within 10 minutes, flag as suspicious.
 * Returns true if suspicious.
 */
export async function checkMultiDeviceAbuse(
  ip: string,
  plateHash: string
): Promise<boolean> {
  const key = `md:${ip}`;
  await redis.sadd(key, plateHash);
  await redis.expire(key, MULTI_DEVICE_WINDOW_SEC);
  const count = await redis.scard(key);
  return count > 1;
}

/**
 * Track geolocation clusters. Two joins from within 10m at the same
 * station within 2 minutes are suspicious.
 */
export async function checkGeoCluster(
  stationId: string,
  lat: number,
  lng: number,
  plateHash: string
): Promise<boolean> {
  const key = `geo:${stationId}`;
  // Store as "plateHash:lat:lng:timestamp"
  const entry = `${plateHash}:${lat}:${lng}:${Date.now()}`;
  await redis.lpush(key, entry);
  await redis.ltrim(key, 0, 19); // keep last 20
  await redis.expire(key, 120); // 2-minute window

  const entries = await redis.lrange(key, 0, -1);
  const twoMinAgo = Date.now() - 120_000;

  for (const e of entries) {
    const [ph, eLat, eLng, ts] = e.split(':');
    if (ph === plateHash) continue; // skip self
    if (parseInt(ts) < twoMinAgo) continue;

    // Approximate distance (good enough for <100m checks)
    const dLat = (parseFloat(eLat) - lat) * 111_320;
    const dLng = (parseFloat(eLng) - lng) * 111_320 * Math.cos(lat * Math.PI / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);

    if (dist < 10) return true; // within 10 meters
  }

  return false;
}
