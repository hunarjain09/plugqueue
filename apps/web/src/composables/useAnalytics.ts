import { getDeviceHash } from '@/lib/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const FLUSH_INTERVAL_MS = 5000; // batch send every 5s
const MAX_BUFFER = 50;

type EventType = 'page_view' | 'flow_step' | 'flow_complete' | 'flow_abandon' |
  'interaction' | 'error' | 'performance' | 'feature_use';

interface AnalyticsEvent {
  event_type: EventType;
  event_name: string;
  station_id?: string;
  page?: string;
  properties?: Record<string, unknown>;
  client_ts?: string;
}

// Shared session ID — persists for the browser session
function getSessionId(): string {
  let sid = sessionStorage.getItem('pq_session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('pq_session_id', sid);
  }
  return sid;
}

// Event buffer + flush
let buffer: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

async function flush() {
  if (buffer.length === 0) return;
  const events = buffer.splice(0, MAX_BUFFER);

  try {
    await fetch(`${BASE_URL}/api/telemetry/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-hash': getDeviceHash(),
      },
      body: JSON.stringify({
        session_id: getSessionId(),
        events,
      }),
    });
  } catch {
    // Re-queue on failure (best-effort)
    buffer.unshift(...events);
  }
}

// Start flush timer on first use
function ensureTimer() {
  if (!flushTimer) {
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
    // Flush on page unload
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('beforeunload', flush);
  }
}

// ─── Public API ────────────────────────────────────────────

export function trackEvent(
  type: EventType,
  name: string,
  opts: { stationId?: string; page?: string; properties?: Record<string, unknown> } = {}
) {
  ensureTimer();
  buffer.push({
    event_type: type,
    event_name: name,
    station_id: opts.stationId,
    page: opts.page,
    properties: opts.properties,
    client_ts: new Date().toISOString(),
  });

  if (buffer.length >= MAX_BUFFER) flush();
}

/** Track a page view — call from each view's onMounted */
export function trackPageView(page: string, stationId?: string) {
  trackEvent('page_view', page, { page, stationId });
}

/** Track a flow step (join queue funnel) */
export function trackFlowStep(name: string, stationId?: string, properties?: Record<string, unknown>) {
  trackEvent('flow_step', name, { stationId, page: 'join', properties });
}

/** Track flow completion */
export function trackFlowComplete(name: string, stationId?: string) {
  trackEvent('flow_complete', name, { stationId });
}

/** Track flow abandonment */
export function trackFlowAbandon(name: string, stationId?: string, properties?: Record<string, unknown>) {
  trackEvent('flow_abandon', name, { stationId, properties });
}

/** Track a button click or interaction */
export function trackInteraction(name: string, page: string, stationId?: string) {
  trackEvent('interaction', name, { page, stationId });
}

/** Track an error */
export function trackError(name: string, page: string, properties?: Record<string, unknown>) {
  trackEvent('error', name, { page, properties });
}

/** Track feature usage (camera, OCR, push, paste) */
export function trackFeatureUse(name: string, stationId?: string, properties?: Record<string, unknown>) {
  trackEvent('feature_use', name, { stationId, properties });
}

/** Track a performance metric (ms) */
export function trackPerformance(name: string, durationMs: number, page?: string) {
  trackEvent('performance', name, { page, properties: { duration_ms: durationMs } });
}

/** Submit user feedback */
export async function submitFeedback(data: {
  rating?: number;
  category: string;
  comment?: string;
  stationId?: string;
  page?: string;
}) {
  try {
    await fetch(`${BASE_URL}/api/telemetry/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-hash': getDeviceHash(),
      },
      body: JSON.stringify({
        session_id: getSessionId(),
        rating: data.rating,
        category: data.category,
        comment: data.comment,
        station_id: data.stationId,
        page: data.page,
      }),
    });
  } catch {
    // Best-effort
  }
}
