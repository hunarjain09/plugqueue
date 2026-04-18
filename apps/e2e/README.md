# @plugqueue/e2e

Playwright smoke tests for the PlugQueue PWA.

## Scope

Smoke only: page load, routing, API reachability against the seed station
`ea-7leaves`. Deep flows (join -> notify -> confirm with WebSocket push) are
intentionally out of scope for now — they require stable real-time
infrastructure and OCR/camera stubbing.

## Prerequisites

The local stack must be running. From the repo root:

```bash
docker compose up -d         # Postgres (PostGIS) + Redis
npm install                  # install workspace deps (once)
# apply migrations + seed (see root CLAUDE.md), then:
npm run dev:api              # Hono API on :3001
npm run dev:web              # Vue PWA  on :5173
```

One-time browser install for Playwright:

```bash
cd apps/e2e
npx playwright install
```

## Running

From the repo root:

```bash
npm run test:e2e
```

Or from `apps/e2e/`:

```bash
npm run test:e2e           # headless
npm run test:e2e:ui        # Playwright UI mode
npm run test:e2e:report    # open last HTML report
```

Override targets with env vars:

- `PLAYWRIGHT_BASE_URL` (default `http://localhost:5173`)
- `PLAYWRIGHT_API_URL`  (default `http://localhost:3001`)

Projects: `chromium` (mobile viewport) and `webkit` (iPhone 14). Runs serial
(`fullyParallel: false`) because queue logic touches shared Postgres/Redis
state.
