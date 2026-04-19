# PlugQueue — Development Workflow & FAQ

> Day-to-day operating manual. Companion to [DEPLOY_STATUS.md](DEPLOY_STATUS.md)
> (snapshot of deploy state) and [CLAUDE.md](CLAUDE.md) (architecture).

---

## 🔄 Normal dev loop

```bash
# One-time, from repo root
npm install
docker compose up -d              # Postgres + Redis

# One-time, apply local migrations + seed
psql $DATABASE_URL < packages/db/migrations/001_initial.sql
psql $DATABASE_URL < packages/db/migrations/002_triggers.sql
psql $DATABASE_URL < packages/db/migrations/003_telemetry.sql
psql $DATABASE_URL < packages/db/seed.sql

# Three terminals
npm run dev:api       # HTTP + WS on :3001
npm run dev:worker    # LISTENs local Postgres for stall_changed
npm run dev:web       # Vite dev server on :5173
```

Then open http://localhost:5173. Every change under `apps/**` hot-reloads via Vite / `tsx watch`.

For **iPhone testing with the local stack**, start a tunnel in a 4th terminal:
```bash
ngrok http 5173        # or `cloudflared tunnel --url http://localhost:5173`
```
Use the generated HTTPS URL on your phone. (Tunnel hosts are whitelisted in `apps/web/vite.config.ts`.)

---

## 🚢 Shipping

Railway + Vercel are both wired to `main` on GitHub. No manual deploy step.

```bash
git add <files>
git commit -m "feat: short description"
git push origin main
```

**What rebuilds based on what you touched** (controlled by each service's "Watch Paths"):

| Changed path | Rebuilds |
|---|---|
| `apps/api/**` | api |
| `apps/worker/**` | worker |
| `apps/cron/**` | cron |
| `apps/web/**` | Vercel web |
| `packages/shared/**` | api + worker + cron (it's a dep) |
| `packages/db/**` | api + worker + cron (migration files shipped together) |
| `packages/shared/**` + web uses it too | Vercel web |

**Don't** rely on auto-deploy if the change is risky — watch the logs:

```bash
railway logs --service api --build --lines 60    # CI phase
railway logs --service api -d       --lines 60    # runtime phase
```

---

## 🗄 Running a new migration against production

```bash
# 1. Write the migration locally
vi packages/db/migrations/004_<description>.sql

# 2. Apply to your local Docker Postgres first — verify it runs clean
docker exec -i plugqueue-postgres psql -U postgres -d plugqueue \
  < packages/db/migrations/004_<description>.sql

# 3. Apply to Railway PostGIS (via the public proxy URL)
docker run --rm -v "$PWD":/w -w /w postgres:16-alpine psql \
  'postgres://postgres:CaFABFEGBC635dd3C6FfbEfdEACb6baE@roundhouse.proxy.rlwy.net:12878/railway' \
  -v ON_ERROR_STOP=1 \
  -f packages/db/migrations/004_<description>.sql

# 4. Commit + push the .sql file so future deploys match
git add packages/db/migrations/004_<description>.sql
git commit -m "db: 004 — <description>"
git push origin main
```

**Rules of thumb:**
- Expressions in indexes must be `IMMUTABLE` — don't use `now()`, `date_trunc` on `timestamptz`, `random()`, etc.
- Prefer additive changes. If you need to drop/rename a column, stage it as `ADD new_col` → backfill → switch reads → `DROP old_col` across 3 separate migrations + deploys.
- Never modify a migration file once it's been applied to prod. Add a new one.

---

## 🐛 Debugging in production

| Tool | When |
|---|---|
| `railway logs --service <name> -d` | Stream runtime logs live |
| `railway logs --service <name> -b` | Build-phase logs only |
| `railway logs --service <name> -d --lines 100` | Historical snapshot |
| `railway run -- node -e 'console.log(process.env.X)'` | Inspect what env vars a service sees |
| `railway variables --service <name>` | List all env vars |
| `railway up --service <name>` | Deploy your *local* working tree without pushing (great for one-off fixes) |
| `railway redeploy --service <name> --yes` | Re-run the latest deploy without any code change |

**Analytics pipeline** for "what happened in the app?":
```sql
-- connect to Railway PostGIS with psql, then:
SELECT event_type, event_name, properties, created_at
FROM analytics_events
ORDER BY created_at DESC LIMIT 50;

SELECT * FROM join_funnel;             -- conversion rates per step
SELECT * FROM page_engagement;         -- page-level metrics
SELECT * FROM daily_stats;             -- (materialized view; cron refreshes)
```

No `console.log` — every error goes through `useAnalytics.ts → /api/telemetry/events → analytics_events`. iOS Safari hides console anyway, so this is your eyes.

---

## ❓ FAQ

### Q: Should Redis be empty?
**Yes.** Redis holds only **ephemeral TTL state** — rate-limit counters, cooldowns, consensus sets, IP→plates tracking. No schema, no migrations. It auto-fills as traffic comes in and auto-expires. Empty = healthy.

### Q: Why are worker / cron "offline" right after I create them?
Because creating a service on Railway just allocates an empty shell. The first deploy only runs after you point the service at a config file (`Settings → Build → Config File = /apps/<name>/railway.json`) and set Watch Paths. Saving those kicks off the first build.

You don't need to `git push` again — `main` already has everything they need.

### Q: I see dozens of modified `*.vue.js` / `*.js.map` files in `git status`. What are they?
Generated output from `vue-tsc`. They were accidentally committed early in the project and now keep regenerating on every build. Ignore them day-to-day. The right fix is:
```bash
# Stop tracking the generated artifacts
git rm --cached apps/web/src/**/*.vue.js apps/web/src/**/*.js apps/web/src/**/*.d.ts.map apps/web/src/**/*.js.map
# Add to .gitignore
cat >> .gitignore <<'EOF'
apps/web/src/**/*.vue.js
apps/web/src/**/*.vue.js.map
apps/web/src/**/*.vue.d.ts.map
apps/web/src/**/*.d.ts.map
apps/web/src/**/*.js.map
apps/web/src/**/*.js   # careful: only if you have no .js sources in web
EOF
git commit -m "chore: stop tracking generated vue-tsc artifacts"
```
(Be careful with that last `*.js` — only use if the `apps/web/src/` tree is TypeScript-only.)

### Q: What env vars does each service need?
See [DEPLOY_STATUS.md](DEPLOY_STATUS.md) → "Full env var reference".

### Q: How do I test that the Railway deploy will work before pushing?
```bash
# Replicates Railway's build + run sequence locally
npm ci
npm run build
node apps/api/dist/index.js

# With Railway env vars injected (best for debugging "works local, breaks prod"):
railway service api
railway run node apps/api/dist/index.js
```

### Q: How do I pick up new Vercel env vars without redeploying from scratch?
Vercel → project → Deployments → three-dot menu on latest → "Redeploy" → uncheck "Use existing build cache". Env changes require a rebuild because Vite bakes them into the bundle at build time.

### Q: The api has `CORS_ORIGIN=*` — is that OK to leave?
Fine for development and personal testing. **Before sharing the URL** or shipping production traffic, tighten it:
```bash
railway variables --service plugqueue --set CORS_ORIGIN=https://<your-vercel-domain>
```

### Q: Turnstile keys — do I need them?
Not for the MVP. `NODE_ENV=development` on Railway skips the enforcement. Grab free keys from Cloudflare before opening to real users. When you do:
```bash
railway variables --service plugqueue \
  --set TURNSTILE_SECRET_KEY=<secret> \
  --set NODE_ENV=production
```
And in Vercel: `VITE_TURNSTILE_SITE_KEY=<site-key>`.

### Q: Where do I see "what happened" in the app?
- **App dashboard**: `/dashboard` route in the web app — KPIs, funnel, feedback
- **DB**: `analytics_events`, `feedback`, `daily_stats` tables (see Debugging section)
- **Railway**: `railway logs --service <name>` for live tail

### Q: How do I add a new station in the future (if we ever support multi-station)?
1. Add an aerial image: `apps/web/public/stations/<id>-aerial.png`
2. Add the lot map JSON: `apps/web/public/stations/<id>.json`
3. Insert the row + stalls into Postgres:
   ```sql
   INSERT INTO stations (id, name, provider, address, location, geofence_m)
   VALUES ('<id>', '<name>', 'Provider', 'Address',
           ST_SetSRID(ST_MakePoint(<lng>, <lat>), 4326)::geography, 200);
   INSERT INTO stalls (station_id, label, connector_type, max_kw) VALUES (...);
   ```
4. Update the DiscoverView's fallback coords if useful.

Right now the router hard-redirects `/` → `/s/ea-7leaves` and Discover's "Coming Soon" badge is visible. To re-enable multi-station, flip the router and remove the disabled styling.

### Q: How do I rotate the VAPID keys if they leak?
```bash
npx web-push generate-vapid-keys
# Update on Railway api + worker:
railway variables --service plugqueue --set VAPID_PUBLIC_KEY=... --set VAPID_PRIVATE_KEY=...
railway variables --service worker    --set VAPID_PUBLIC_KEY=... --set VAPID_PRIVATE_KEY=...
# Update on Vercel web:
#   VITE_VAPID_PUBLIC_KEY=<new-public>
# Existing push subscriptions become invalid. Users must re-subscribe.
```

### Q: What if I need to delete all queue entries for testing?
```sql
TRUNCATE queue_entries, queue_flags RESTART IDENTITY CASCADE;
UPDATE stalls SET current_status='unknown', status_updated_at=NULL;
```
Redis will catch up on its own (TTL keys expire). Alternatively flush:
```
docker run --rm redis:7-alpine redis-cli -u 'redis://default:PASSWORD@proxy.rlwy.net:PORT' FLUSHDB
```

---

## 🧭 Service responsibility quick reference

| Service | What it runs | What breaks if it's down |
|---|---|---|
| api | Hono HTTP + WebSocket + in-process notification timer | Users can't join, leave, confirm, or see live queue |
| worker | Postgres LISTEN loop, queue advancement, push delivery | Queue stops advancing when stalls free; push notifications stop |
| cron | 5-min cleanup (expire, salt-rotate, refresh analytics view) | Stale queue entries accumulate; salt never rotates (plate hashes stay linkable) |
| web (Vercel) | Vue 3 PWA static files | Users can't load the app |
| PostGIS | All persistent state | Everything stops |
| Redis | Rate limits, cooldowns, consensus counters | Abuse protection degrades; API starts erroring on `SADD`/`INCR` calls |

---

## 📝 Commit message convention

Match what's already in `git log`:
```
<type>(<scope>): <summary>

Optional body explaining why.

Co-Authored-By: ...
```

Types I've been using: `feat`, `fix`, `chore`, `docs`, `db`.
Scopes: `web`, `api`, `worker`, `cron`, `shared`, `e2e`, `deploy`.

Example:
```
fix(web): trackFeatureUse takes (name, stationId?, properties?)

The TopBar's push_subscribe tracking passed properties in the
stationId slot. Railway build failed with TS2345.
```

---

## 🧯 Post-mortems — deploy pitfalls we already hit

These cost us a lot of time; don't repeat them.

### 1. `vercel link --yes` auto-creates a new project
Running `vercel link --yes` (or any first-time `vercel` command) in a fresh directory with no `.vercel/` folder creates a **new Vercel project named after the directory**. It will NOT auto-join your existing project.

**How to link to an existing project:**
```bash
cd apps/web
vercel link --project plugqueue-web
```

### 2. `vercel --prod` from repo root triggers services auto-detection
From the monorepo root, Vercel detects multiple apps (`apps/api`, `apps/web`) and auto-creates a multi-service `vercel.json` + a new project. It will try to host the Hono api as Vercel Functions — which breaks because our api uses WebSocket + Postgres LISTEN/NOTIFY, neither of which works in serverless.

**Only run `vercel --prod` from `apps/web`**, with Root Directory unset in the project (so the CLI and the dashboard agree on the path).

### 3. `vercel --prod` from `apps/web` when Root Directory is set to `apps/web`
Error: `~/Downloads/plugqueue/apps/web/apps/web does not exist`. Vercel appends its Root Directory setting to the CWD.

**Fix:** Either (a) unset Root Directory in the dashboard and deploy from `apps/web`, or (b) keep Root Directory and deploy from repo root (but see #2 — the root triggers services auto-detect).

Pragmatic workaround we settled on: let the GitHub integration auto-deploy on `git push`. Skip local `vercel --prod` unless you specifically need an unshipped-code preview.

### 4. Leading whitespace in Vercel env var values breaks fetches
Pasting env var values into the Vercel dashboard can introduce a leading space. Vite bakes env vars literally into the bundle at build time, so you end up with `fetch(" https://...")` which throws `Failed to fetch` (no network error, no CORS — just a malformed URL).

**Diagnosis:** Grep the built JS bundle for your API URL:
```bash
BUNDLE=$(curl -s https://<vercel-url>/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -s "https://<vercel-url>/$BUNDLE" | grep -oE '" https://[^"]+"'
```
If you see a quoted string with a leading space → the env var is contaminated.

**Fix via CLI (avoids paste issues):**
```bash
vercel env rm VITE_API_BASE_URL production --yes
echo "https://plugqueue-production.up.railway.app" | vercel env add VITE_API_BASE_URL production
vercel --prod --yes   # or just push to trigger rebuild
```

### 5. Custom headers from the frontend must be allowed by the server's CORS config
We kept a `ngrok-skip-browser-warning: true` header in `apps/web/src/lib/api.ts` as a ngrok-tier workaround. After deploy, Hono's CORS middleware only allows `Content-Type, x-device-hash` in `Access-Control-Allow-Headers`, so preflight blocked every API call.

**Lesson:** Any custom request header added to the client must be whitelisted on the server (Hono's `cors({ allowHeaders: [...] })`). Or just don't add the header if it's only needed for dev.

### 6. Vercel's Deployment Protection (team plan default)
Team-plan Vercel projects enable "Vercel Authentication" on new deployments by default, which gates every URL behind Vercel's SSO wall. `curl` sees `HTTP/2 401 + _vercel_sso_nonce cookie`; browsers see a 404-looking page that's actually the redirect to login.

**Fix:** Project → Settings → Deployment Protection → set "Vercel Authentication" to **Only Preview Deployments** (or Off). Production URLs become publicly reachable immediately; no redeploy needed.

### 7. Minimal `vercel.json` for SPA routing
After much config thrashing, the working config for a Vite SPA in a monorepo is exactly this. **Anything extra is suspect — especially `cleanUrls: true` and `framework: null`.**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd ../.. && npm ci && npx turbo build --filter=@plugqueue/web",
  "outputDirectory": "dist",
  "installCommand": "echo 'deferred to buildCommand so it runs from monorepo root'",
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

`cleanUrls: true` intercepted the filesystem lookup before the rewrite could fire — every deep route 404'd even with a correct rewrite block.

### 8. Generic debug playbook for Vercel 404s (in order)
When a deep route 404s:
1. `curl -sI <url>` — look for `401` + `_vercel_sso_nonce` → deployment protection
2. Test the deploy-hash URL directly (`plugqueue-xxx-...vercel.app`) not just the alias — isolates alias/DNS bugs
3. `vercel inspect <url> --logs | head -5` — confirm the right commit deployed
4. Strip `vercel.json` to only `rewrites: [{ "source": "/(.*)", "destination": "/" }]` and redeploy
5. Add config back one field at a time

---
