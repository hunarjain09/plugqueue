const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const deviceHash = getDeviceHash();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-device-hash': deviceHash,
      ...options.headers,
    },
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(
      `Server error (${res.status}). Please try again.`,
      'PARSE_ERROR',
      res.status
    );
  }
  if (!data.ok) {
    throw new ApiError(data.error, data.code, res.status);
  }
  return data.data;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getDeviceHash(): string {
  let hash = localStorage.getItem('pq_device_hash');
  if (!hash) {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    hash = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('pq_device_hash', hash);
  }
  return hash;
}

export const api = {
  getStationsNearby(lat: number, lng: number, radius = 5000) {
    return request<any[]>(`/api/stations/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
  },

  getStation(id: string) {
    return request<any>(`/api/stations/${encodeURIComponent(id)}`);
  },

  joinQueue(stationId: string, data: {
    plate: string;
    spot_id?: string;
    push_sub_id?: string;
    lat: number;
    lng: number;
    turnstile_token?: string;
  }) {
    return request<any>(`/api/queue/join?station_id=${encodeURIComponent(stationId)}`, {
      method: 'POST',
      body: JSON.stringify({ ...data, device_hash: getDeviceHash() }),
    });
  },

  leaveQueue(entryId: string) {
    return request<any>('/api/queue/leave', {
      method: 'POST',
      body: JSON.stringify({ entry_id: entryId, device_hash: getDeviceHash() }),
    });
  },

  confirmCharge(entryId: string) {
    return request<any>('/api/queue/confirm', {
      method: 'POST',
      body: JSON.stringify({ entry_id: entryId, device_hash: getDeviceHash() }),
    });
  },

  flagEntry(queueEntryId: string, reason?: string) {
    return request<any>('/api/queue/flag', {
      method: 'POST',
      body: JSON.stringify({
        queue_entry_id: queueEntryId,
        flagger_device: getDeviceHash(),
        reason,
      }),
    });
  },

  updateStallStatus(stationId: string, stalls: { label: string; status: string }[], observedAt: string) {
    return request<any>(`/api/station/${encodeURIComponent(stationId)}/update-status`, {
      method: 'POST',
      body: JSON.stringify({
        stalls,
        device_hash: getDeviceHash(),
        observed_at: observedAt,
      }),
    });
  },

  subscribePush(subscription: { id: string; endpoint: string; p256dh: string; auth: string }) {
    return request<any>('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ ...subscription, device_hash: getDeviceHash() }),
    });
  },

  getVapidKey() {
    return request<{ key: string }>('/api/push/vapid-key');
  },
};
