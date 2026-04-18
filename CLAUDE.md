# PlugQueue

Privacy-first EV charging queue management PWA for a specific Electrify America station at **540-548 Lawrence Expy, Sunnyvale, CA 94085** (7 Leaves Cafe plaza). 4 DC fast chargers (2x 150kW CCS/CHAdeMO + 2x 350kW CCS).

Built with Vue 3 + Hono + Postgres/PostGIS + Redis, deployed to Railway.

## Quick Start

```bash
npm install          # install all workspace dependencies
npm run dev:api      # start API on :3001
npm run dev:web      # start Vue PWA on :5173
```

Requires local Postgres (with PostGIS) and Redis. Run migrations first:
```bash
psql $DATABASE_URL < packages/db/migrations/001_initial.sql
psql $DATABASE_URL < packages/db/migrations/002_triggers.sql
psql $DATABASE_URL < packages/db/migrations/003_telemetry.sql
psql $DATABASE_URL < packages/db/seed.sql
```

## The Station

This is a **single-station deployment** — not a marketplace for arbitrary chargers. The multi-station schema exists in the codebase for future expansion, but the MVP targets one specific location.

- **Station ID**: `ea-7leaves`
- **Provider**: Electrify America
- **Stalls**: 4 (labeled 1-4), arranged in a row at the bottom-left corner of the parking lot
- **Aerial photo**: `apps/web/public/stations/ea-7leaves-aerial.png`
- **Lot map JSON**: `apps/web/public/stations/ea-7leaves.json` (stall positions as % coordinates over the aerial photo)
- **Seed data**: `packages/db/seed.sql`

The join flow uses an **aerial photo map** where users tap directly on the stall they're at. This is more innovative than industry standard (Tesla, EA, ChargePoint all use flat lists/grids). Our approach uses CSS `position: absolute` with percentage positioning over a static `<img>` — no heavy mapping libraries needed for 4 stalls.

## Architecture

5 services in a monorepo, deployed to Railway:

| Service | Path | What it does |
|---------|------|-------------|
| **API** | `apps/api` | Hono HTTP + WebSocket. All business logic. |
| **Worker** | `apps/worker` | LISTEN/NOTIFY subscriber. Advances queue when stall freed. Sends push. Auto-reconnects on disconnect. |
| **Cron** | `apps/cron` | Runs every 5 min. Cleanup, salt rotation, analytics refresh. Disables triggers during bulk ops. |
| **Web** | `apps/web` | Vue 3 PWA. All user-facing UI. Custom service worker for push notifications (injectManifest). |
| **Shared** | `packages/shared` | TypeScript types, Zod schemas, constants (single source of truth for all timing values). |
| **DB** | `packages/db` | SQL migrations (001 schema, 002 triggers, 003 telemetry) and seed data. |

### How the queue works

1. User scans plate (on-device OCR via Tesseract.js) → selects stall on aerial map → joins queue
2. Join is wrapped in a **transaction with advisory lock** to prevent concurrent duplicates
3. Postgres trigger fires `NOTIFY stall_changed` when a stall status changes
4. Worker picks up the NOTIFY via LISTEN, finds next waiting entry via `FOR UPDATE SKIP LOCKED`, sends push notification
5. User has **3 minutes** to confirm (reminder push at 2 min, expire at 3 min)
6. If no confirmation → entry expires → next person notified → expired user gets "spot given away" push
7. If user leaves geofence while in queue → auto-leave via `useGeofenceWatch`

### Key files by task

<!-- Progressive disclosure: start with the section relevant to your task -->

**Fixing a bug:**
- `apps/api/src/routes/queue.ts` — join (with advisory lock + Turnstile), leave (escalating cooldown), confirm, flag
- `apps/api/src/routes/status.ts` — stall status updates + consensus model (2-report threshold, 10-min fallback)
- `apps/worker/src/index.ts` — LISTEN loop with auto-reconnect + exponential backoff + periodic reconciliation
- `apps/api/src/lib/notificationTimer.ts` — 60s timer: sends reminder at 2 min, expires at 3 min, fires pg_notify for queue advancement

**Changing the schema:**
- `packages/db/migrations/` — numbered SQL migrations (run in order). Tables have CHECK constraints on status columns.
- `packages/shared/src/types/index.ts` — TypeScript types. MUST match schema. `plate_display` not `plate` (raw plate is never stored).
- `packages/shared/src/schemas/index.ts` — Zod validation schemas for API input
- `packages/shared/src/constants.ts` — ALL timing/threshold values. Never hardcode these elsewhere.

**Touching the frontend:**
- `apps/web/src/views/` — 8 route views (Discover, Station, JoinQueue, LiveQueue, YourTurn, UpdateStatus, Dashboard)
- `apps/web/src/components/AerialSpotSelector.vue` — aerial photo with tappable stall overlays. Loads lot map from `/stations/{id}.json`.
- `apps/web/src/composables/useWebSocket.ts` — exponential backoff reconnect (1s→30s, max 20 retries), `connectionLost` state
- `apps/web/src/composables/useGeofenceWatch.ts` — accepts reactive refs for station coordinates, auto-leaves if user exits geofence
- `apps/web/src/composables/useAnalytics.ts` — event buffer with 5s flush, uncaught error piping, no console.log (iOS Safari)
- `apps/web/src/composables/useOverlayQueue.ts` — serializes overlays: privacy → tour → install (one at a time)
- `apps/web/src/stores/station.ts` — Pinia store. Persists `myEntry` to localStorage. Validates against server on startup.
- `apps/web/src/sw.ts` — Service worker: Workbox precaching + push/notificationclick handlers (injectManifest strategy)
- `apps/web/src/lib/api.ts` — API client. Uses `encodeURIComponent` on IDs. Handles non-JSON responses gracefully.

**Debugging security:**
- `apps/api/src/middleware/rateLimit.ts` — dual device+IP rate limiting via atomic Lua script. Trusts only `x-forwarded-for` (not `cf-connecting-ip`).
- `apps/api/src/middleware/turnstile.ts` — on all POST endpoints. Fail-closed in production. Hono v4 memoizes `c.req.json()` (documented behavior).
- `apps/api/src/lib/redis.ts` — atomic rate limit Lua, escalating cooldowns, multi-device detection (IP→plates tracking), geo clustering
- `apps/api/src/lib/hash.ts` — `hashPlate()` (current salt), `hashPlateWithPrevious()` (dual-salt for overlap window). Generates initial salt if none exists (no static fallback).
- `apps/api/src/routes/push.ts` — validates push endpoints against known domains (FCM, Mozilla, Apple, Windows). Delete requires matching device_hash.

**Working on telemetry:**
- `packages/db/migrations/003_telemetry.sql` — `analytics_events` table, `feedback` table, `daily_stats` materialized view, `join_funnel` and `page_engagement` views
- `apps/api/src/routes/telemetry.ts` — batch event ingestion, feedback, daily stats API, drop-off analysis
- `apps/web/src/composables/useAnalytics.ts` — client-side event buffer. `trackPageView`, `trackFlowStep`, `trackFlowComplete`, `trackError`, `trackFeatureUse`, `submitFeedback`
- `apps/web/src/components/FeedbackSheet.vue` — floating feedback button + sheet with rating, category, comment
- `apps/web/src/views/DashboardView.vue` — KPIs, daily activity chart, join funnel, exit points, top stations, feedback summary

## Critical Design Decisions

### Single-station MVP
The code supports multiple stations (schema, routing, API) but the frontend defaults to `ea-7leaves`. The Discover view exists but users primarily land on the station page directly. Keep multi-station code — don't delete it — but don't over-invest in station discovery UX for now.

### Privacy model
- **No accounts.** Identity = anonymous device hash (localStorage) + daily-rotating plate hash.
- **Plate is NEVER stored in plaintext.** Column is `plate_display` (masked: `ABC***`). Raw plate only exists in browser memory during OCR.
- **Camera images never leave the device.** Tesseract.js runs in the browser.
- **Queue entries auto-delete** after 24h (cron).
- **Daily salt rotates at midnight** — previous salt kept for 2h overlap to prevent in-flight breakage.

### Anti-abuse layers (6 deep)
1. **Turnstile** on all POST endpoints (join, leave, confirm, flag, status update). Fail-closed in production.
2. **Dual rate limiting**: per-device-hash (30/min) + per-IP (60/min) via atomic Lua script (no immortal keys).
3. **Geofence**: must be within station radius. Client-supplied coordinates (known limitation — can be faked).
4. **Cooldowns**: escalating (30min → 2h → 24h) via `COOLDOWN_TIERS_SEC`. Postgres fallback re-warms Redis with actual remaining TTL.
5. **Multi-device detection**: same IP with 2+ plates in 10 min = blocked. Geo clustering checks for 2 joins <10m apart.
6. **Community flagging**: 3 flags = auto-expire. Also Turnstile-gated. Push delete requires matching device_hash.

### Consensus model for status updates
- `in_use → available` requires **2 independent device reports** within 5 min (via Redis SADD)
- **Time-based fallback**: single report auto-applies after **10 minutes** with no contradiction (prevents single-user stations from being stuck forever)
- `available → in_use` applies immediately (no abuse incentive)
- Consensus check runs inside the transaction client (`FOR UPDATE` on stalls row) to prevent TOCTOU race

### Worker resilience
- LISTEN client auto-reconnects with exponential backoff (1s→30s) instead of `process.exit`
- Runs reconciliation after every reconnect to catch missed events
- Periodic reconciliation every 5 minutes as safety net
- Reconciliation uses `EXISTS` subquery to avoid cross-product duplicates
- WebSocket LISTEN has the same reconnect pattern + broadcasts fresh snapshots to all clients after reconnect

### Notification timing
- All values in `packages/shared/src/constants.ts` — single source of truth
- `NOTIFICATION_CONFIRM_WINDOW_SEC = 180` (3 minutes)
- `NOTIFICATION_REMINDER_SEC = 120` (reminder push at 2 min mark)
- In-process timer (60s interval) is primary enforcer; cron is safety net (also fires pg_notify)
- YourTurnView calculates remaining time from server's `notified_at`, not from component mount
- `remindedEntries` is a `Map<id, timestamp>` with automatic eviction (not an unbounded Set)

### Aerial map stall selector
- Uses CSS `position: absolute` with percentage positioning over a static aerial photo
- No heavy libraries (Leaflet, Canvas, etc.) — 4 stalls don't need it
- Stall positions defined in `/stations/{id}.json` (per-station lot map)
- Accessibility: use `<button>` elements with `aria-label`, `aria-pressed`, `role="group"`
- Performance: avoid `backdrop-blur` on individual stall buttons (compositing cost on older iPhones)
- For 6+ stall stations in the future: consider adding `pinch-zoom-element` (~2KB)

## Testing

```bash
cd apps/api && npm test
```

4 test files:
| File | Coverage |
|------|----------|
| `queue-lifecycle.test.ts` | Full E2E queue flows: join → wait → notify → confirm, leave + cooldown, flag auto-expire, stall status changes, LISTEN/NOTIFY firing, parallel worker safety |
| `state-transitions.test.ts` | All valid transitions (waiting→notified, notified→charging, etc.), invalid transitions (expired→notified rejected, etc.), CHECK constraint enforcement, FK enforcement on snapshots, position tie-breaking, privacy verification (no raw plate in DB) |
| `p1-backend-fixes.test.ts` | Regression tests: atomic rate limit keys have TTL, cooldown re-warm uses actual TTL from Postgres, reconciliation returns distinct stations, advisory lock prevents concurrent duplicates |
| `telemetry.test.ts` | Event ingestion (single, batch, JSONB properties, client timestamp), feedback (with/without rating, invalid rating rejected), join funnel tracking (complete + abandoned), error recording, page view counts, exit page detection, feature usage |

Requires running Postgres (with PostGIS) and Redis. Tests create tables, seed data, and clean up between runs via `beforeEach`.

## Telemetry & Observability

No console.log — everything goes to the DB via the analytics pipeline (critical for iOS Safari where console is inaccessible).

**Client-side capture** (`useAnalytics.ts`):
- Buffers events, flushes every 5s or on `visibilitychange`/`beforeunload`
- Tracks: page views (auto via route watcher), flow steps (join funnel), interactions, errors (uncaught + unhandled rejections), feature usage (OCR duration, push subscribe), performance metrics

**Server-side storage** (`003_telemetry.sql`):
- `analytics_events` — raw event log with device_hash, session_id, event_type, event_name, page, station_id, JSONB properties
- `feedback` — explicit user ratings (1-5) with category and comment
- `daily_stats` — materialized view refreshed by cron
- `join_funnel` — view computing step-by-step conversion rates
- `page_engagement` — view with views, unique visitors, interactions, bounces per page

**Dashboard** (`/dashboard`):
- KPI cards (users, sessions, events, avg rating)
- Daily activity bar chart
- Join queue funnel with step-by-step dropoff
- Exit page analysis (where users leave)
- Top stations by activity
- Feedback summary by category (positive/negative counts, avg rating)

**API** (`GET /api/telemetry/stats/daily?days=7`, `GET /api/telemetry/stats/dropoffs?days=7`)

## Deployment

```bash
./scripts/setup-railway.sh   # one-time Railway setup (interactive prompts for domains + Turnstile keys)
```

**Required env vars in production** (API refuses to start without these):
- `CORS_ORIGIN` — exact origin, NOT `*`
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — for push notifications
- `DATABASE_URL` / `REDIS_URL` — via Railway variable references (`${{postgresql.DATABASE_URL}}`)

**Security headers**: Hono `secureHeaders()` middleware adds HSTS, X-Content-Type-Options, X-Frame-Options.

## Design System

"Glacier" — glacial, editorial aesthetic. See `stitch/glacier_light/DESIGN.md`.

| Token | Light | Dark |
|-------|-------|------|
| Background | `#f7f9fb` | `#0a0e1a` |
| Primary | `#006591` | `#7dd3fc` |
| Primary Container | `#0ea5e9` | `#0e4d6e` |
| On Surface | `#191c1e` | `#e0e8f0` |
| On Surface Variant | `#3e4850` | `#a0b4c4` |

- Inter font, tonal layering (no borders, no dividers), glassmorphism on overlays
- Full-radius (9999px) CTAs, 2rem rounded cards
- Material Symbols Outlined icons
- Tailwind CSS v4 with custom `@theme` tokens in `apps/web/src/app.css`
- Design reference screens in `stitch/` folder (each has `code.html` + `screen.png`)

## Design Reference Screens (stitch/)

| Screen | Folder | Key elements |
|--------|--------|-------------|
| Station discovery (dark) | `station_discovery_no_profile/` | Map + floating station card |
| Live queue (light) | `live_queue_status/` | Position hero, community queue list |
| Join — plate scan (dark) | `join_queue_photo_capture/` | Camera viewfinder, OCR indicator |
| Join — spot selection (light) | `select_spot_4_stalls/` | 2x2 grid over lot photo |
| Join — spot on aerial (dark) | `select_parking_spot/` | Aerial photo with tappable stalls |
| Your turn (light) | `your_turn_to_charge/` | Hero card, stall assignment, confirm/leave |
| Update status (dark) | `update_station_status_1/` | Paste area, parsed stall list |
| Update status 4-stall (light) | `update_status_4_stalls/` | Toggle switches, consensus indicators |
| Queue dashboard 4-stall | `queue_dashboard_4_stalls/` | Position #, flow rate, verification badges |
| Alerts | `alerts_notifications/` | Push notification cards |
