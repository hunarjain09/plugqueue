# Deploying PlugQueue to Railway (free tier)

This guide deploys all 4 services to Railway using free `.up.railway.app` subdomains. No custom DNS required.

Railway's recommended pattern for isolated monorepos is **Dashboard + CLI hybrid**: create the project and services via the web dashboard (so each service's root directory can be set), then use the CLI to seed environment variables and run migrations. The Railway CLI no longer supports creating monorepo services with root directories purely from the terminal.

---

## Prerequisites

1. **Railway CLI**
   ```bash
   npm i -g @railway/cli
   railway login
   ```
2. **GitHub account + repo** (Railway deploys from GitHub)
3. **Turnstile site + secret keys** — free at https://dash.cloudflare.com/?to=/:account/turnstile
   (Optional for MVP: if you skip, set `NODE_ENV=development` — the API refuses to start in production without Turnstile.)

---

## Step 1 — Push to GitHub

Create an empty repo on github.com (don't initialize with README), then:

```bash
git remote add origin https://github.com/<your-username>/plugqueue.git
git push -u origin main
```

If you don't have the GitHub CLI, you can use [GitHub Desktop](https://desktop.github.com/) or create the repo on github.com and run the commands above.

---

## Step 2 — Create the Railway project + databases

```bash
railway init --name plugqueue
railway add --database postgres
railway add --database redis
```

The Postgres addon ships with PostGIS available — you'll enable it in Step 4.

---

## Step 3 — Create the 4 services (Dashboard)

The CLI does not support setting a service's root directory. Do this in the dashboard:

For **each** of the 4 services below, click **+ New → Deploy from GitHub repo** → select your `plugqueue` repo → in the service **Settings**:

- **Root Directory** → set per table below
- **Build Command** → leave default (Railpack detects it)
- **Config as Code** → already present in each app's `railway.json`

| Service name      | Root Directory   | Type           |
| ----------------- | ---------------- | -------------- |
| `plugqueue-api`   | `/apps/api`      | HTTP           |
| `plugqueue-worker`| `/apps/worker`   | Background     |
| `plugqueue-cron`  | `/apps/cron`     | Background     |
| `plugqueue-web`   | `/apps/web`      | Static / HTTP  |

> **Do not** trigger a deploy yet — the services will fail until env vars are set in Step 4.

---

## Step 4 — Seed environment variables + generate free URLs

Run the helper script from the repo root:

```bash
./scripts/setup-railway.sh
```

It prompts for Turnstile keys (optional) and then:
- Generates VAPID keys for web push
- Generates free `.up.railway.app` domains for `plugqueue-api` and `plugqueue-web`
- Sets all environment variables on each service (with Railway variable references for `DATABASE_URL` and `REDIS_URL`)
- Enables PostGIS and runs all migrations + seed data

When it finishes, it prints the two URLs (web + API).

---

## Step 5 — Trigger deploys

In the Railway dashboard, go to each service → **Deployments** → **Deploy**. Watch the build logs.

Services will start in this order (they wait for DB/Redis via `healthcheckPath`):
1. `plugqueue-api` — must be healthy before others connect
2. `plugqueue-worker`, `plugqueue-cron` — LISTEN on Postgres, connect to Redis
3. `plugqueue-web` — static build; references the API URL at build time

Once `plugqueue-web` is green, open its free URL and you should see the station page.

---

## Maintenance

**Tail logs:**
```bash
railway logs --service plugqueue-api
railway logs --service plugqueue-worker
```

**Connect to Postgres:**
```bash
railway connect Postgres
```

**Re-run migrations:**
```bash
railway run --service Postgres psql < packages/db/migrations/001_initial.sql
```

**Force redeploy after pushing code:**
Push to `main`. Railway auto-deploys each service whose root directory changed.

---

## Troubleshooting

- **"TURNSTILE_SECRET_KEY must be set"** — either set it via `railway variables --set TURNSTILE_SECRET_KEY=... --service plugqueue-api` or set `NODE_ENV=development` on the API service.
- **Web service 404s on routes** — the Vue Router uses history mode; make sure `plugqueue-web`'s `railway.json` has a SPA fallback config, or serve via the API.
- **Worker can't connect to DB** — verify it has `DATABASE_URL` set to `${{Postgres.DATABASE_URL}}` (the exact service name matters — check Railway dashboard for the actual casing).
- **`railway add --database postgres` failed** — the syntax changed in CLI v4. Try `railway add` and pick Postgres interactively.
