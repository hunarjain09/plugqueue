# PlugQueue Deploy Status & Handoff

> Snapshot of the Railway deployment state and the remaining manual steps.
> Last updated: 2026-04-18, Railway project **`modest-nourishment`**.

---

## ✅ What's already live

| Piece | State | URL / detail |
|---|---|---|
| **api** (Railway service `plugqueue`) | 🟢 Online | https://plugqueue-production.up.railway.app |
| `GET /health` | 🟢 200 | `{"status":"ok",...}` |
| `GET /api/stations/ea-7leaves` | 🟢 200 | station + 4 stalls returned |
| **PostGIS** (Railway service `PostGIS`) | 🟢 Online | `postgis.railway.internal` (internal) |
| — Migrations applied | ✅ | 001, 002, 003 + seed (`ea-7leaves`, 4 stalls) |
| **Redis** (Railway service `Redis`) | 🟢 Online | `redis.railway.internal` |
| **worker** (Railway service `worker`) | ⚠️ Created, env vars set, **not yet deployed** | no public URL |
| **cron** (Railway service `cron`) | ⚠️ Created, env vars set, **not yet deployed** | no public URL |
| **web** (Vercel) | ❌ Not deployed | — |

---

## 🔧 Remaining manual steps

### 1. Railway dashboard — finish configuring `worker`

Open **Railway → modest-nourishment → worker** and set:

- **Settings → Source → Root Directory**: *leave empty* (repo root)
- **Settings → Source → Watch Paths** (one per line):
  ```
  apps/worker/**
  packages/shared/**
  packages/db/**
  ```
- **Settings → Build → Config File**: `/apps/worker/railway.json`
- **Settings → Networking → Public Networking**: *leave OFF* (no public domain needed; worker is outbound-only)

After saving, Railway will redeploy automatically. Watch **Deployments** tab.

### 2. Railway dashboard — finish configuring `cron`

Open **Railway → modest-nourishment → cron** and set:

- **Settings → Source → Root Directory**: *leave empty*
- **Settings → Source → Watch Paths**:
  ```
  apps/cron/**
  packages/shared/**
  packages/db/**
  ```
- **Settings → Build → Config File**: `/apps/cron/railway.json`
- **Settings → Networking → Public Networking**: *leave OFF*
- Cron schedule `*/5 * * * *` is read from `apps/cron/railway.json` automatically — no dashboard field needed.

### 3. Deploy `web` to Vercel

1. Go to https://vercel.com → **Add New → Project** → import `hunarjain09/plugqueue`
2. **Root Directory**: `apps/web`
3. **Framework Preset**: Vite
4. **Build Command**: `cd ../.. && npm ci && npm run build --filter=@plugqueue/web`
5. **Output Directory**: `dist`
6. **Environment Variables** (add under Settings → Environment Variables):
   ```
   VITE_API_BASE_URL=https://plugqueue-production.up.railway.app
   VITE_WS_BASE_URL=wss://plugqueue-production.up.railway.app
   VITE_VAPID_PUBLIC_KEY=BEegQ0mRv1yh_p4MaI8zjdyqCuyjUCMvjFk9bPloLKoHNA9fheWcrQWFWxrCLbdrSkJbpeBqVs6nF_lhpsI169w
   VITE_TURNSTILE_SITE_KEY=(leave empty — Turnstile disabled in dev mode)
   ```
7. **Deploy** → copy the generated URL (something like `plugqueue.vercel.app`)

### 4. (Optional but recommended) Lock down CORS

After the Vercel URL is known, restrict the API to that origin:

```bash
railway variables --service plugqueue \
  --set CORS_ORIGIN=https://<your-vercel-domain>.vercel.app
```

Currently `CORS_ORIGIN=*` — fine for testing, but update before sharing publicly.

---

## 📋 Full env var reference (what's already set)

### Service `plugqueue` (api)
```
NODE_ENV           = development   ← disables strict Turnstile enforcement
CORS_ORIGIN        = *
DATABASE_URL       = ${{PostGIS.DATABASE_URL}}
REDIS_URL          = ${{Redis.REDIS_URL}}
VAPID_PUBLIC_KEY   = BEegQ0mRv1yh_...
VAPID_PRIVATE_KEY  = Dk6HHLvxS530...
VAPID_SUBJECT      = mailto:admin@plugqueue.app
PORT               = 8080          ← auto-injected by Railway
```

### Service `worker`
```
NODE_ENV           = development
DATABASE_URL       = ${{PostGIS.DATABASE_URL}}
REDIS_URL          = ${{Redis.REDIS_URL}}
VAPID_PUBLIC_KEY   = (same as api)
VAPID_PRIVATE_KEY  = (same as api)
VAPID_SUBJECT      = mailto:admin@plugqueue.app
WEB_URL            = https://plugqueue-production.up.railway.app
```

### Service `cron`
```
NODE_ENV           = development
DATABASE_URL       = ${{PostGIS.DATABASE_URL}}
REDIS_URL          = ${{Redis.REDIS_URL}}
```

---

## 🧪 Verification checklist (after all steps above)

### Api
```bash
curl https://plugqueue-production.up.railway.app/health
# → {"status":"ok", ...}

curl -H "x-device-hash: test" \
  https://plugqueue-production.up.railway.app/api/stations/ea-7leaves
# → {"ok":true,"data":{"id":"ea-7leaves", ... 4 stalls}}
```

### Worker
```bash
railway logs --service worker --deployment --lines 30
# Look for: "Redis connected", "LISTEN subscriptions active"
# No errors, no restart loops
```

### Cron
Cron runs every 5 min. After one run:
```bash
railway logs --service cron --deployment --lines 30
# Look for: "[cron] Connected to database" + counts of expired/purged rows
```

### Web (Vercel)
Visit the Vercel URL in Safari, then:
- Discover should redirect to `/s/ea-7leaves`
- Station page loads with 4 stalls
- Tap notification bell → iOS prompt
- PWA install (Share → Add to Home Screen) → relaunch → push subscription lands in DB

Confirm push subscription:
```bash
docker run --rm postgres:16-alpine psql \
  'postgres://postgres:CaFABFEGBC635dd3C6FfbEfdEACb6baE@roundhouse.proxy.rlwy.net:12878/railway' \
  -c 'select count(*) from push_subscriptions;'
```

---

## 🛠 Useful Railway CLI commands

```bash
# Which project/service am I linked to?
railway status

# Switch linked service
railway service <name>

# Stream logs live (default = deploy logs)
railway logs --service plugqueue
railway logs --service worker -d
railway logs --service cron -d

# Historical logs (last N lines)
railway logs --service plugqueue --build  --lines 80
railway logs --service plugqueue -d       --lines 80

# Inspect/set variables
railway variables --service <name>
railway variables --service <name> --set KEY=value --skip-deploys

# Manually redeploy latest main
railway redeploy --service <name> --yes

# Deploy uncommitted local code (no git push)
railway up --service <name>
```

---

## 🐛 Common failure modes

### `Cannot find module '/app/dist/index.js'`
Start command must use monorepo-root path. Each service's `railway.json` has been patched to:
- api: `node apps/api/dist/index.js`
- worker: `node apps/worker/dist/index.js`
- cron: `node apps/cron/dist/index.js`

If you see this error, double-check **Settings → Build → Config File** points at the correct `railway.json`.

### `TURNSTILE_SECRET_KEY must be set in production`
Set `NODE_ENV=development` on the service (already done). To harden later, grab free Turnstile keys from https://dash.cloudflare.com/?to=/:account/turnstile and set `TURNSTILE_SECRET_KEY` (server) and `VITE_TURNSTILE_SITE_KEY` (Vercel).

### `extension "postgis" is not available`
The old vanilla `Postgres` service doesn't have PostGIS. **We switched to a `PostGIS` service pointing at `postgis/postgis:16-master`.** If you see this error, the api is pointing at the wrong DB — verify its `DATABASE_URL` references `${{PostGIS.DATABASE_URL}}`, not `${{Postgres.DATABASE_URL}}`.

### `npm ci` fails with missing packages
Root lockfile is out of sync. Fix: `npm install` locally, commit `package-lock.json`, push.

### Build succeeds but healthcheck fails
Check `railway logs --service <name> -d` for a crash log. 99% of the time it's a missing env var the service's startup code requires.

---

## 📦 What the app still needs (known gaps)

1. **Turnstile** — get real keys before opening to public traffic.
2. **Tight CORS** — currently `*`; set to Vercel domain.
3. **Worker resilience** — already has auto-reconnect (`apps/worker/src/index.ts`) but untested on Railway.
4. **Cron observability** — verify the `*/5 * * * *` schedule actually fires; Railway cron services show run history in the dashboard.
5. **Custom domain** — both Railway (api) and Vercel (web) support custom domains, free.
6. **Migrate strategy** — right now migrations were applied manually from local. Future: a one-shot Railway job, or run them in api's startup if none applied.

---

## 🌐 URLs reference

| Purpose | URL |
|---|---|
| API health | https://plugqueue-production.up.railway.app/health |
| API station | https://plugqueue-production.up.railway.app/api/stations/ea-7leaves |
| Railway project | https://railway.com/project/31af1406-bd70-4efa-b58a-3d1cd5d0ec1d |
| GitHub repo | https://github.com/hunarjain09/plugqueue |
| PostGIS public JDBC | `postgres://postgres:CaFABFEGBC635dd3C6FfbEfdEACb6baE@roundhouse.proxy.rlwy.net:12878/railway` |

---

## 🔑 Cleanup after success

Once everything works and you want to share:
1. Set `NODE_ENV=production` on api (after adding real Turnstile keys)
2. Set `CORS_ORIGIN` to the actual Vercel domain
3. Delete the `humorous-emotion` Railway project (leftover from experiments)
4. Rotate `VAPID_PRIVATE_KEY` if you consider it exposed via this file — generate new ones with `npx web-push generate-vapid-keys`
