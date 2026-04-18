/** How long a notified user has to confirm before being expired (seconds) */
export const NOTIFICATION_CONFIRM_WINDOW_SEC = 3 * 60; // 3 minutes

/** When to send the "Are you plugged in?" reminder push (seconds after notification) */
export const NOTIFICATION_REMINDER_SEC = 2 * 60; // 2 minutes (1 min before expiry)

/** How long before a waiting entry is considered stale and expired (seconds) */
export const QUEUE_ENTRY_TTL_SEC = 2 * 60 * 60; // 2 hours

/** Default cooldown after leaving the queue (seconds) */
export const DEFAULT_COOLDOWN_SEC = 30 * 60; // 30 minutes

/** Escalating cooldown tiers (seconds) */
export const COOLDOWN_TIERS_SEC = [
  30 * 60,     // 1st leave: 30 minutes
  2 * 60 * 60, // 2nd leave: 2 hours
  24 * 60 * 60, // 3rd+ leave: 24 hours
] as const;

/** How often the in-process notification timer runs (ms) */
export const NOTIFICATION_TIMER_INTERVAL_MS = 60_000; // 60 seconds

/** How long old completed/expired entries are kept before purge (seconds) */
export const ENTRY_PURGE_AGE_SEC = 24 * 60 * 60; // 24 hours

/** How long old snapshots are kept before purge (seconds) */
export const SNAPSHOT_PURGE_AGE_SEC = 7 * 24 * 60 * 60; // 7 days

/** Rate limit: requests per window per device hash */
export const RATE_LIMIT_DEVICE = { limit: 30, windowSec: 60 };

/** Rate limit: requests per window per IP */
export const RATE_LIMIT_IP = { limit: 60, windowSec: 60 };

/** Multi-device detection window (seconds) */
export const MULTI_DEVICE_WINDOW_SEC = 600; // 10 minutes

/** Status update consensus: reports needed to apply in_use → available */
export const CONSENSUS_THRESHOLD = 2;

/** Status update consensus window (seconds) */
export const CONSENSUS_WINDOW_SEC = 300; // 5 minutes
