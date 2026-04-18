#!/usr/bin/env bash
#
# PlugQueue — Railway Post-Setup Helper
# =====================================
# Run AFTER you have:
#   1. Pushed the repo to GitHub
#   2. Created a Railway project with `railway init --name plugqueue`
#   3. Added Postgres + Redis via the dashboard or:
#        railway add --database postgres
#        railway add --database redis
#   4. Created the 4 services in the dashboard (plugqueue-api, -worker,
#      -cron, -web) with their Root Directory set to /apps/<name>.
#
# What this script does:
#   • Generates VAPID keys for web push
#   • Generates free .up.railway.app domains for the API + web services
#   • Seeds env vars on all 4 services (DATABASE_URL and REDIS_URL as refs)
#   • Enables PostGIS + runs migrations + seed
#
# See DEPLOY.md for full context.

set -euo pipefail

# ─── Colors ─────────────────────────────────────────────────
BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${BLUE}[plugqueue]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ─── Pre-flight ─────────────────────────────────────────────
command -v railway >/dev/null 2>&1 || err "Railway CLI not found. Install: npm i -g @railway/cli"
command -v npx     >/dev/null 2>&1 || err "npx not found. Install Node.js 20+."
railway whoami >/dev/null 2>&1      || err "Not logged in. Run: railway login"
railway status >/dev/null 2>&1      || err "No project linked. Run: railway init or railway link"
ok "Railway CLI ready, project linked"

SVC_API="plugqueue-api"
SVC_WORKER="plugqueue-worker"
SVC_CRON="plugqueue-cron"
SVC_WEB="plugqueue-web"

# The Railway dashboard names managed DB services "Postgres"/"Redis" (casing
# matters for ${{Postgres.DATABASE_URL}} variable references). If yours differ
# (e.g. lowercase "postgres" when added via a specific CLI path), override:
#   PG_SVC=Postgres REDIS_SVC=Redis ./scripts/setup-railway.sh
PG_SVC="${PG_SVC:-Postgres}"
REDIS_SVC="${REDIS_SVC:-Redis}"

# ─── Turnstile (optional) ──────────────────────────────────
read -rp "Turnstile secret key (leave blank to run API in development mode): " TURNSTILE_SECRET
read -rp "Turnstile site key (leave blank): " TURNSTILE_SITE_KEY
VAPID_SUBJECT_DEFAULT="mailto:admin@example.com"
read -rp "VAPID subject email [${VAPID_SUBJECT_DEFAULT}]: " VAPID_SUBJECT
VAPID_SUBJECT="${VAPID_SUBJECT:-$VAPID_SUBJECT_DEFAULT}"

# ─── Generate VAPID keys ───────────────────────────────────
log "Generating VAPID keys..."
VAPID_OUTPUT=$(npx --yes web-push generate-vapid-keys 2>/dev/null)
VAPID_PUBLIC=$(echo "$VAPID_OUTPUT"  | grep "Public Key:"  | awk '{print $NF}')
VAPID_PRIVATE=$(echo "$VAPID_OUTPUT" | grep "Private Key:" | awk '{print $NF}')
[ -n "$VAPID_PUBLIC" ] && [ -n "$VAPID_PRIVATE" ] || err "Failed to generate VAPID keys"
ok "VAPID keys generated"

# ─── Generate free Railway domains ─────────────────────────
# `railway domain` with no args on a service generates a free <svc>-<hash>.up.railway.app
log "Generating free Railway domain for ${SVC_API}..."
railway service "$SVC_API" >/dev/null
API_DOMAIN_RAW=$(railway domain 2>&1 | tail -5 | grep -oE '[a-zA-Z0-9.-]+\.up\.railway\.app' | head -1 || true)
[ -n "$API_DOMAIN_RAW" ] || err "Couldn't generate API domain. Run 'railway domain' manually on ${SVC_API}."
ok "API domain: https://$API_DOMAIN_RAW"

log "Generating free Railway domain for ${SVC_WEB}..."
railway service "$SVC_WEB" >/dev/null
WEB_DOMAIN_RAW=$(railway domain 2>&1 | tail -5 | grep -oE '[a-zA-Z0-9.-]+\.up\.railway\.app' | head -1 || true)
[ -n "$WEB_DOMAIN_RAW" ] || err "Couldn't generate web domain. Run 'railway domain' manually on ${SVC_WEB}."
ok "Web domain: https://$WEB_DOMAIN_RAW"

API_URL="https://$API_DOMAIN_RAW"
WEB_URL="https://$WEB_DOMAIN_RAW"
API_WS_URL="wss://$API_DOMAIN_RAW"

# ─── Helper to set a variable ──────────────────────────────
# Railway CLI v4 exposes both `railway variables --set` (legacy) and
# `railway variable set` (current). We try the current form first and fall
# back to the legacy form so the script keeps working across CLI minor
# versions.
set_var() {
  # $1 service name, $2 KEY=VALUE
  if ! railway variable set "$2" --service "$1" >/dev/null 2>&1; then
    railway variables --service "$1" --set "$2" >/dev/null
  fi
}

# ─── plugqueue-api ─────────────────────────────────────────
log "Setting variables on ${SVC_API}..."
set_var "$SVC_API" "DATABASE_URL=\${{${PG_SVC}.DATABASE_URL}}"
set_var "$SVC_API" "REDIS_URL=\${{${REDIS_SVC}.REDIS_URL}}"
set_var "$SVC_API" "VAPID_PUBLIC_KEY=$VAPID_PUBLIC"
set_var "$SVC_API" "VAPID_PRIVATE_KEY=$VAPID_PRIVATE"
set_var "$SVC_API" "VAPID_SUBJECT=$VAPID_SUBJECT"
set_var "$SVC_API" "CORS_ORIGIN=$WEB_URL"
set_var "$SVC_API" "WEB_URL=$WEB_URL"

if [ -n "$TURNSTILE_SECRET" ]; then
  set_var "$SVC_API" "TURNSTILE_SECRET_KEY=$TURNSTILE_SECRET"
  set_var "$SVC_API" "NODE_ENV=production"
else
  warn "No Turnstile secret — running API in development mode (no Turnstile enforcement)"
  set_var "$SVC_API" "NODE_ENV=development"
fi
ok "${SVC_API} variables set"

# ─── plugqueue-worker ──────────────────────────────────────
log "Setting variables on ${SVC_WORKER}..."
set_var "$SVC_WORKER" "DATABASE_URL=\${{${PG_SVC}.DATABASE_URL}}"
set_var "$SVC_WORKER" "REDIS_URL=\${{${REDIS_SVC}.REDIS_URL}}"
set_var "$SVC_WORKER" "VAPID_PUBLIC_KEY=$VAPID_PUBLIC"
set_var "$SVC_WORKER" "VAPID_PRIVATE_KEY=$VAPID_PRIVATE"
set_var "$SVC_WORKER" "VAPID_SUBJECT=$VAPID_SUBJECT"
set_var "$SVC_WORKER" "WEB_URL=$WEB_URL"
set_var "$SVC_WORKER" "NODE_ENV=production"
ok "${SVC_WORKER} variables set"

# ─── plugqueue-cron ────────────────────────────────────────
log "Setting variables on ${SVC_CRON}..."
set_var "$SVC_CRON" "DATABASE_URL=\${{${PG_SVC}.DATABASE_URL}}"
set_var "$SVC_CRON" "REDIS_URL=\${{${REDIS_SVC}.REDIS_URL}}"
set_var "$SVC_CRON" "NODE_ENV=production"
ok "${SVC_CRON} variables set"

# ─── plugqueue-web (Vite build-time vars) ──────────────────
log "Setting variables on ${SVC_WEB}..."
set_var "$SVC_WEB" "VITE_API_BASE_URL=$API_URL"
set_var "$SVC_WEB" "VITE_WS_BASE_URL=$API_WS_URL"
set_var "$SVC_WEB" "VITE_VAPID_PUBLIC_KEY=$VAPID_PUBLIC"
if [ -n "$TURNSTILE_SITE_KEY" ]; then
  set_var "$SVC_WEB" "VITE_TURNSTILE_SITE_KEY=$TURNSTILE_SITE_KEY"
fi
ok "${SVC_WEB} variables set"

# ─── Migrations ────────────────────────────────────────────
log "Enabling PostGIS + running migrations..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Link to the Postgres service and run psql
railway service "$PG_SVC" >/dev/null

railway run -- psql <<'SQL' || warn "PostGIS extension enable failed — may already be enabled"
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
SQL
ok "PostGIS extensions enabled"

railway run -- psql < "$REPO_ROOT/packages/db/migrations/001_initial.sql" && ok "001_initial.sql applied"
railway run -- psql < "$REPO_ROOT/packages/db/migrations/002_triggers.sql" && ok "002_triggers.sql applied"
railway run -- psql < "$REPO_ROOT/packages/db/migrations/003_telemetry.sql" && ok "003_telemetry.sql applied"
railway run -- psql < "$REPO_ROOT/packages/db/seed.sql" && ok "seed.sql applied"

# ─── Summary ───────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  PlugQueue setup complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  Web:    $WEB_URL"
echo "  API:    $API_URL"
echo "  Health: $API_URL/health"
echo ""
echo "  Next: go to the Railway dashboard and trigger a deploy on each service,"
echo "        or push a new commit and Railway will auto-deploy."
echo ""
echo "  Useful commands:"
echo "    railway logs --service $SVC_API"
echo "    railway logs --service $SVC_WORKER"
echo "    railway service $PG_SVC && railway run -- psql"
echo ""
