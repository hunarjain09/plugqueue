export interface Station {
  id: string;
  name: string;
  provider: string;
  address: string | null;
  location: { lat: number; lng: number };
  geofence_m: number;
  indoor: boolean;
  lot_map_url: string | null;
  created_at: string;
}

export interface Stall {
  id: string;
  station_id: string;
  label: string;
  connector_type: string;
  max_kw: number;
  current_status: StallStatus;
  status_updated_at: string | null;
}

export type StallStatus = 'available' | 'in_use' | 'offline' | 'unknown';

export interface QueueEntry {
  id: string;
  station_id: string;
  plate_display: string;
  plate_hash: string;
  spot_id: string | null;
  waiting_spot_id: string | null;
  device_hash: string;
  joined_at: string;
  status: QueueStatus;
  notified_at: string | null;
  push_sub_id: string | null;
}

export type QueueStatus = 'waiting' | 'notified' | 'charging' | 'expired' | 'left';

export interface StationSnapshot {
  id: string;
  station_id: string;
  stall_label: string;
  stall_status: StallStatus;
  observed_at: string;
  submitted_at: string;
  device_hash: string;
}

export interface SessionStat {
  id: string;
  station_id: string;
  session_id: string;
  provider: string;
  duration_sec: number;
  energy_kwh: number;
  cost_usd: number | null;
  connector_type: string;
  max_kw_observed: number | null;
  device_hash: string;
  submitted_at: string;
}

export interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_hash: string;
  created_at: string;
  last_used_at: string | null;
}

export interface QueueFlag {
  id: string;
  queue_entry_id: string;
  flagger_device: string;
  reason: string | null;
  created_at: string;
}

// WebSocket message types
export type WsMessage =
  | { type: 'snapshot'; queue: QueueEntry[]; stalls: Stall[] }
  | { type: 'queue_update'; queue: QueueEntry[] }
  | { type: 'stall_update'; stall_label: string; status: StallStatus };

// API response wrappers
export interface ApiResponse<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  code?: string;
}

export interface StationDetail extends Station {
  stalls: Stall[];
  queue: QueueEntry[];
  queue_size: number;
  available_stalls: number;
  estimated_wait_min: number | null;
}
