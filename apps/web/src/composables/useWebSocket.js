import { ref, onUnmounted } from 'vue';
const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? `ws://${window.location.host}`;
const MAX_RETRIES = 20;
export function useWebSocket(stationId) {
    const connected = ref(false);
    const queue = ref([]);
    const stalls = ref([]);
    const connectionLost = ref(false);
    let ws = null;
    let reconnectTimer = null;
    let retryCount = 0;
    let disposed = false;
    function connect() {
        if (disposed)
            return;
        if (retryCount >= MAX_RETRIES) {
            connectionLost.value = true;
            return;
        }
        ws = new WebSocket(`${WS_BASE}/ws?station=${stationId}`);
        ws.onopen = () => {
            connected.value = true;
            connectionLost.value = false;
            retryCount = 0; // reset on successful connect
        };
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
                case 'snapshot':
                    queue.value = msg.queue;
                    stalls.value = msg.stalls;
                    break;
                case 'queue_update':
                    queue.value = msg.queue;
                    break;
                case 'stall_update': {
                    const idx = stalls.value.findIndex((s) => s.label === msg.stall_label);
                    if (idx >= 0) {
                        stalls.value[idx] = { ...stalls.value[idx], current_status: msg.status };
                    }
                    break;
                }
            }
        };
        ws.onclose = () => {
            connected.value = false;
            if (disposed)
                return;
            // Exponential backoff: 1s, 2s, 4s, 8s, ... capped at 30s
            retryCount++;
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
            reconnectTimer = setTimeout(connect, delay);
        };
        ws.onerror = () => {
            ws?.close();
        };
    }
    function disconnect() {
        disposed = true;
        if (reconnectTimer)
            clearTimeout(reconnectTimer);
        ws?.close();
        ws = null;
    }
    function retry() {
        retryCount = 0;
        connectionLost.value = false;
        connect();
    }
    connect();
    onUnmounted(disconnect);
    return { connected, connectionLost, queue, stalls, disconnect, retry };
}
//# sourceMappingURL=useWebSocket.js.map