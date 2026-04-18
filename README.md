# PlugQueue

> Privacy-first EV charging queue for a specific Electrify America station.

## What it is

PlugQueue is a PWA that solves the "arrive and hope" problem at a busy DC fast-charging station. Drivers join a virtual queue from their phone, get notified when a stall opens, and confirm they're plugging in — without accounts, logins, or any personal data stored server-side.

It targets one real-world location: the Electrify America plaza at **540-548 Lawrence Expy, Sunnyvale, CA 94085** (behind 7 Leaves Cafe), with 4 DC fast chargers (2×150 kW + 2×350 kW CCS/CHAdeMO). Although the schema and routing support multiple stations, the MVP is intentionally single-station — the goal is to prove the flow at one station before adding discovery UX.

The join flow uses a tap-to-select **aerial photo** of the actual lot rather than the flat list or grid that Tesla, Electrify America, and ChargePoint all use. For 4 stalls this is implemented with plain CSS absolute positioning over a static image — no Leaflet, no Canvas, no mapping library.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vue 3 + Vite PWA, Pinia, Tailwind CSS v4, Workbox SW (injectManifest) |
| API | Hono (HTTP + WebSocket) on Node 20 |
| Data | Postgres 16 + PostGIS, Redis |
| Realtime | Postgres `LISTEN/NOTIFY`, WebSocket broadcast |
| OCR | Tesseract.js (runs on-device in the browser) |
| Push | Web Push with VAPID |
| Tooling | npm workspaces + Turborepo, TypeScript |
| Deploy | Railway (4 services + Postgres + Redis) |

## Architecture

Five workspaces in a single monorepo:

| Package | Path | Role |
|---------|------|------|
| API | [apps/api](apps/api/) | HTTP + WebSocket. All business logic: join/leave/confirm/flag, status consensus, push subscribe, telemetry. |
| Worker | [apps/worker](apps/worker/) | Long-running `LISTEN` subscriber. Advances the queue when a stall frees, sends push. Auto-reconnects with exponential backoff + periodic reconciliation. |
| Cron | [apps/cron](apps/cron/) | Runs every 5 minutes. Expires stale entries, rotates the daily plate salt, refreshes the analytics materialized view. |
| Web | [apps/web](apps/web/) | Vue 3 PWA. All user-facing UI, aerial-photo stall selector, custom service worker for push. |
| Shared | [packages/shared](packages/shared/) | TypeScript types, Zod schemas, timing/threshold constants. Single source of truth. |
| DB | [packages/db](packages/db/) | Numbered SQL migrations (schema, triggers, telemetry) and seed data. |

The queue engine is zero-polling: stall status changes fire a Postgres trigger → `NOTIFY stall_changed` → the worker picks it up via `LISTEN`, selects the next waiting entry with `FOR UPDATE SKIP LOCKED`, and delivers a web push. The API has its own `LISTEN` subscriber for `queue_changed` that broadcasts fresh snapshots to WebSocket clients.

## Quick start (local)

Requires Node 20+, Docker, and npm 10.

```bash
npm install
docker compose up -d                                            # Postgres+PostGIS and Redis
psql $DATABASE_URL < packages/db/migrations/001_initial.sql
psql $DATABASE_URL < packages/db/migrations/002_triggers.sql
psql $DATABASE_URL < packages/db/migrations/003_telemetry.sql
psql $DATABASE_URL < packages/db/seed.sql
npm run dev:api &
npm run dev:worker &
npm run dev:web
# open http://localhost:5173
```

A root-level `.env` is auto-loaded: the API/worker/cron use `tsx --env-file=../../.env` and the web app uses Vite's `envDir: '../..'`. Copy [`.env.example`](.env.example) to `.env` and fill in the VAPID keys and (optional for dev) Turnstile keys.

## Deployment

The free-tier Railway flow — 4 services on `.up.railway.app` subdomains, no custom DNS — is documented in [DEPLOY.md](DEPLOY.md). A helper script at `scripts/setup-railway.sh` seeds environment variables, generates VAPID keys, enables PostGIS, and runs migrations.

## Design philosophy

**Privacy**

- No accounts, no email, no phone number. Identity is an anonymous device hash (localStorage) plus a daily-rotating plate hash.
- Plate text is never stored in plaintext. The DB column is `plate_display` (masked, e.g. `ABC***`). Raw plate text only exists in browser memory during OCR.
- Camera images never leave the device — Tesseract.js runs in the browser.
- Queue entries auto-delete after 24h. The plate salt rotates at midnight, with the previous salt retained for a 2-hour overlap so in-flight cooldowns don't break.

**Anti-abuse (six layers)**

1. Cloudflare Turnstile on all POST endpoints (fail-closed in production).
2. Dual rate limiting — per-device-hash and per-IP — via an atomic Redis Lua script.
3. PostGIS geofence on join.
4. Escalating cooldowns (30 min → 2h → 24h) with a Postgres fallback that re-warms Redis using the actual remaining TTL.
5. Multi-device / geo-clustering detection (same IP with 2+ plates in 10 min; 2 joins within 10m of each other).
6. Community flagging — 3 flags expires an entry.

**Consensus for stall status**

A user-reported transition of `in_use → available` is not trusted from a single observer, but requiring N reports would leave single-user stations stuck forever. PlugQueue requires **2 independent device reports within 5 minutes**, with a **10-minute time-based fallback** that auto-applies a single report when no one has contradicted it. Consensus state is tracked in Redis (`SADD`) and checked inside the transaction with `FOR UPDATE` on the stalls row to avoid TOCTOU races. `available → in_use` applies immediately (no abuse incentive).

## Testing

Vitest suite under [apps/api](apps/api/) — requires running Postgres and Redis:

```bash
cd apps/api && npm test
```

| File | Coverage |
|------|----------|
| `queue-lifecycle.test.ts` | End-to-end: join → wait → notify → confirm; leave + cooldown; flag auto-expire; stall-status changes; LISTEN/NOTIFY firing; parallel-worker safety. |
| `state-transitions.test.ts` | Valid and invalid queue-entry state transitions, CHECK constraints, FK enforcement, position tie-breaking, privacy check (no plaintext plate in DB). |
| `p1-backend-fixes.test.ts` | Regressions: atomic rate-limit keys have TTL, cooldown re-warm uses actual TTL, reconciliation returns distinct stations, advisory lock prevents concurrent duplicates. |
| `telemetry.test.ts` | Event ingestion (single / batch / JSONB), feedback with rating validation, join-funnel tracking, error recording, page-view counts, exit-page detection. |

## License

TBD.

## Further reading

- [CLAUDE.md](CLAUDE.md) — full architecture, file-by-task map, critical design decisions.
- [DEPLOY.md](DEPLOY.md) — Railway deployment (free-tier subdomains).
- [WIKI.md](WIKI.md) — deep-dive with sequence / state / ERD diagrams.
