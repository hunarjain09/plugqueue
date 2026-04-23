-- 004: Add waiting_spot_id to queue_entries
-- Stores which parking lot spot (L1, ML3, BR7, etc.) a driver is waiting in.
-- Unique per active entry so no two people claim the same spot simultaneously.

ALTER TABLE queue_entries
  ADD COLUMN IF NOT EXISTS waiting_spot_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS queue_entries_active_waiting_spot_idx
  ON queue_entries (station_id, waiting_spot_id)
  WHERE status IN ('waiting', 'notified') AND waiting_spot_id IS NOT NULL;
