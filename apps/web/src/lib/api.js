const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
async function request(path, options = {}) {
    const deviceHash = getDeviceHash();
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-device-hash': deviceHash,
            ...options.headers,
        },
    });
    let data;
    try {
        data = await res.json();
    }
    catch {
        throw new ApiError(`Server error (${res.status}). Please try again.`, 'PARSE_ERROR', res.status);
    }
    if (!data.ok) {
        throw new ApiError(data.error, data.code, res.status);
    }
    return data.data;
}
export class ApiError extends Error {
    code;
    status;
    constructor(message, code, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'ApiError';
    }
}
export function getDeviceHash() {
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
    getStationsNearby(lat, lng, radius = 5000) {
        return request(`/api/stations/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
    },
    getStation(id) {
        return request(`/api/stations/${encodeURIComponent(id)}`);
    },
    joinQueue(stationId, data) {
        return request(`/api/queue/join?station_id=${encodeURIComponent(stationId)}`, {
            method: 'POST',
            body: JSON.stringify({ ...data, device_hash: getDeviceHash() }),
        });
    },
    leaveQueue(entryId) {
        return request('/api/queue/leave', {
            method: 'POST',
            body: JSON.stringify({ entry_id: entryId, device_hash: getDeviceHash() }),
        });
    },
    confirmCharge(entryId) {
        return request('/api/queue/confirm', {
            method: 'POST',
            body: JSON.stringify({ entry_id: entryId, device_hash: getDeviceHash() }),
        });
    },
    flagEntry(queueEntryId, reason) {
        return request('/api/queue/flag', {
            method: 'POST',
            body: JSON.stringify({
                queue_entry_id: queueEntryId,
                flagger_device: getDeviceHash(),
                reason,
            }),
        });
    },
    updateStallStatus(stationId, stalls, observedAt) {
        return request(`/api/station/${encodeURIComponent(stationId)}/update-status`, {
            method: 'POST',
            body: JSON.stringify({
                stalls,
                device_hash: getDeviceHash(),
                observed_at: observedAt,
            }),
        });
    },
    subscribePush(subscription) {
        return request('/api/push/subscribe', {
            method: 'POST',
            body: JSON.stringify({ ...subscription, device_hash: getDeviceHash() }),
        });
    },
    getVapidKey() {
        return request('/api/push/vapid-key');
    },
};
//# sourceMappingURL=api.js.map