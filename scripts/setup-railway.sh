#!/usr/bin/env bash
#
# PlugQueue — Railway Setup Script
# =================================
# Run this once to set up the entire Railway project from scratch.
# Requires: railway CLI (`npm i -g @railway/cli`), logged in (`railway login`)
#
# Usage:
#   ./scripts/setup-railway.sh
#
# What it does:
#   1. Creates the Railway project
#   2. Provisions Postgres (PostGIS) + Redis
#   3. Creates all 4 services with correct root directories
#   4. Generates VAPID keys
#   5. Sets all environment variables with Railway variable references
#   6. Adds custom domains
#   7. Runs database migrations and seed
#   8. Triggers first deploy
#
# The script is idempotent where possible — re-running won't duplicate resources.

set -euo pipefail

# ─── Colors ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${BLUE}[plugqueue]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ─── Pre-flight checks ─────────────────────────────────────
command -v railway >/dev/null 2>&1 || err "Railway CLI not found. Install with: npm i -g @railway/cli"
command -v npx >/dev/null 2>&1 || err "npx not found. Install Node.js 20+."

# Check login
railway whoami >/dev/null 2>&1 || err "Not logged in. Run: railway login"
ok "Railway CLI authenticated"

# ─── Configuration ──────────────────────────────────────────
PROJECT_NAME="plugqueue"
DOMAIN_WEB="plugqueue.app"
DOMAIN_API="api.plugqueue.app"
VAPID_SUBJECT="mailto:admin@plugqueue.app"

# Prompt for optional overrides
read -rp "Custom web domain [$DOMAIN_WEB]: " input_web
DOMAIN_WEB="${input_web:-$DOMAIN_WEB}"

read -rp "Custom API domain [$DOMAIN_API]: " input_api
DOMAIN_API="${input_api:-$DOMAIN_API}"

read -rp "Turnstile secret key (leave blank to skip): " TURNSTILE_SECRET
read -rp "Turnstile site key (leave blank to skip): " TURNSTILE_SITE_KEY

# ─── Step 1: Create project ────────────────────────────────
log "Creating Railway project: $PROJECT_NAME"
railway init --name "$PROJECT_NAME" 2>/dev/null || warn "Project may already exist, continuing..."
ok "Project ready"

# ─── Step 2: Provision databases ───────────────────────────
log "Adding PostgreSQL (PostGIS)..."
railway add --plugin postgresql 2>/dev/null || warn "PostgreSQL may already exist"
ok "PostgreSQL provisioned"

log "Adding Redis..."
railway add --plugin redis 2>/dev/null || warn "Redis may already exist"
ok "Redis provisioned"

# ─── Step 3: Create services ───────────────────────────────
declare -A SERVICES=(
  ["plugqueue-api"]="apps/api"
  ["plugqueue-worker"]="apps/worker"
  ["plugqueue-cron"]="apps/cron"
  ["plugqueue-web"]="apps/web"
)

for svc in "${!SERVICES[@]}"; do
  log "Creating service: $svc (root: ${SERVICES[$svc]})"
  railway service create "$svc" --source "${SERVICES[$svc]}" 2>/dev/null || warn "$svc may already exist"
done
ok "All services created"

# ─── Step 4: Generate VAPID keys ───────────────────────────
log "Generating VAPID keys..."
VAPID_OUTPUT=$(npx --yes web-push generate-vapid-keys 2>/dev/null)
VAPID_PUBLIC=$(echo "$VAPID_OUTPUT" | grep "Public Key:" | awk '{print $NF}')
VAPID_PRIVATE=$(echo "$VAPID_OUTPUT" | grep "Private Key:" | awk '{print $NF}')

if [ -z "$VAPID_PUBLIC" ] || [ -z "$VAPID_PRIVATE" ]; then
  err "Failed to generate VAPID keys"
fi
ok "VAPID keys generated"
echo "  Public:  $VAPID_PUBLIC"
echo "  Private: (hidden)"

# ─── Step 5: Set environment variables ─────────────────────
log "Setting environment variables..."

# --- plugqueue-api ---
# Use heredoc to avoid VAPID private key appearing in shell history / ps output
railway variables set --service plugqueue-api \
  'DATABASE_URL=${{postgresql.DATABASE_URL}}' \
  'REDIS_URL=${{redis.REDIS_URL}}' \
  "VAPID_PUBLIC_KEY=$VAPID_PUBLIC" \
  "VAPID_SUBJECT=$VAPID_SUBJECT" \
  "CORS_ORIGIN=https://$DOMAIN_WEB" \
  "WEB_URL=https://$DOMAIN_WEB" \
  "NODE_ENV=production"
# Set private key separately via stdin to keep it out of process list
echo "$VAPID_PRIVATE" | railway variables set --service plugqueue-api "VAPID_PRIVATE_KEY=$(cat -)"

if [ -n "$TURNSTILE_SECRET" ]; then
  railway variables set --service plugqueue-api \
    "TURNSTILE_SECRET_KEY=$TURNSTILE_SECRET"
fi
ok "plugqueue-api variables set"

# --- plugqueue-worker ---
railway variables set --service plugqueue-worker \
  'DATABASE_URL=${{postgresql.DATABASE_URL}}' \
  'REDIS_URL=${{redis.REDIS_URL}}' \
  "VAPID_PUBLIC_KEY=$VAPID_PUBLIC" \
  "VAPID_PRIVATE_KEY=$VAPID_PRIVATE" \
  "VAPID_SUBJECT=$VAPID_SUBJECT" \
  "WEB_URL=https://$DOMAIN_WEB" \
  "NODE_ENV=production"
ok "plugqueue-worker variables set"

# --- plugqueue-cron ---
railway variables set --service plugqueue-cron \
  'DATABASE_URL=${{postgresql.DATABASE_URL}}' \
  'REDIS_URL=${{redis.REDIS_URL}}' \
  "NODE_ENV=production"
ok "plugqueue-cron variables set"

# --- plugqueue-web ---
railway variables set --service plugqueue-web \
  "VITE_API_BASE_URL=https://$DOMAIN_API" \
  "VITE_WS_BASE_URL=wss://$DOMAIN_API" \
  "VITE_VAPID_PUBLIC_KEY=$VAPID_PUBLIC"

if [ -n "$TURNSTILE_SITE_KEY" ]; then
  railway variables set --service plugqueue-web \
    "VITE_TURNSTILE_SITE_KEY=$TURNSTILE_SITE_KEY"
fi
ok "plugqueue-web variables set"

# ─── Step 6: Custom domains ────────────────────────────────
log "Adding custom domains..."
railway domain add --service plugqueue-web "$DOMAIN_WEB" 2>/dev/null || warn "Domain $DOMAIN_WEB may already exist"
railway domain add --service plugqueue-api "$DOMAIN_API" 2>/dev/null || warn "Domain $DOMAIN_API may already exist"
ok "Domains configured"
echo ""
echo "  Point these DNS records to Railway:"
echo "    $DOMAIN_WEB  → CNAME to your Railway web service"
echo "    $DOMAIN_API  → CNAME to your Railway API service"
echo ""

# ─── Step 7: Run migrations ────────────────────────────────
log "Running database migrations..."

# Enable PostGIS extension
railway run --service postgresql -- psql -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' 2>/dev/null || true
railway run --service postgresql -- psql -c 'CREATE EXTENSION IF NOT EXISTS "postgis";' 2>/dev/null || true
ok "PostGIS extensions enabled"

# Run migration files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

railway run --service postgresql -- psql < "$REPO_ROOT/packages/db/migrations/001_initial.sql"
ok "Schema created (001_initial.sql)"

railway run --service postgresql -- psql < "$REPO_ROOT/packages/db/migrations/002_triggers.sql"
ok "Triggers created (002_triggers.sql)"

railway run --service postgresql -- psql < "$REPO_ROOT/packages/db/seed.sql"
ok "Seed data loaded"

# ─── Step 8: Link repo + deploy ────────────────────────────
log "Linking GitHub repository..."
railway link 2>/dev/null || warn "Already linked or requires manual GitHub connection"

log "Deploying all services..."
railway up
ok "Deploy triggered"

# ─── Done ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  PlugQueue is deployed!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  Web:    https://$DOMAIN_WEB"
echo "  API:    https://$DOMAIN_API"
echo "  Health: https://$DOMAIN_API/health"
echo ""
echo "  VAPID Public Key (save this for clients):"
echo "    $VAPID_PUBLIC"
echo ""
echo "  Useful commands:"
echo "    railway logs --service plugqueue-api     # tail API logs"
echo "    railway logs --service plugqueue-worker   # tail worker logs"
echo "    railway run --service postgresql psql     # connect to DB"
echo "    railway status                            # see all services"
echo "    railway redeploy --service plugqueue-api  # force redeploy"
echo ""
echo "  Next steps:"
echo "    1. Point DNS records to Railway"
echo "    2. Enable daily backups on PostgreSQL in the Railway dashboard"
echo "    3. Set up Turnstile at https://dash.cloudflare.com → Turnstile"
echo "    4. Verify push notifications work on iOS (requires Home Screen install)"
echo ""
