# PlugQueue — MVP Live Test Flow

> Drive to **540-548 Lawrence Expy, Sunnyvale, CA 94085**
> (Electrify America behind 7 Leaves Cafe, 4 DC fast chargers).
> All user actions are captured via telemetry into `analytics_events` — every tap, page view, error, and feature_use lands in Postgres.

---

## 🛠 Pre-flight (do these at home before leaving)

**1. Remove the stale bundle on every test device**

Each device you'll test with needs to pull the latest deploy. For PWA-installed devices, this is the step people forget.

- **iPhone Safari (web)**: Settings → Safari → Clear History and Website Data
- **iPhone PWA (Add to Home Screen)**: long-press icon → Delete App → re-add from Safari after visiting the URL
- **Mac Chrome**: DevTools → Application → Storage → Clear site data → reload

**2. Confirm the three services are green**

```bash
curl -sI https://plugqueue-production.up.railway.app/health | head -1
# → HTTP/2 200

curl -sI https://plugqueue-web.vercel.app/s/ea-7leaves | head -1
# → HTTP/2 200
```

Check Railway dashboard `cron` service shows "Ready, Next in X min".

**3. Seed dashboard with a baseline count** (so you can diff post-visit)

```bash
docker run --rm postgres:16-alpine psql \
  'postgres://postgres:CaFABFEGBC635dd3C6FfbEfdEACb6baE@roundhouse.proxy.rlwy.net:12878/railway' \
  -c "SELECT count(*) AS before_visit FROM analytics_events;"
```
Save the number. You'll compare after.

---

## 🚗 At the station — happy path

**Order matters.** Each step exercises a different layer. If you break at step N, you know everything before N worked.

### Step 1 — First open (cold, no PWA yet)
- Open Safari → `https://plugqueue-web.vercel.app`
- **Expect:**
  - Privacy disclaimer bottom-sheet ("Your Privacy Matters")
  - Tap **Got It**
  - Lands on station page, 4 stalls listed
  - ✅ **Station name, address, 4 stalls with status "unknown"**
- Failure → screenshot + tap the feedback 🗨️ button (bottom-right floating blue bubble)

### Step 2 — Enable notifications (requires PWA install)
iOS web push only works from the home-screen PWA.
- Share ↑ → Add to Home Screen → Add
- Open from home-screen icon (not Safari)
- Tap the 🔔 bell (top-right) with red "1" badge
- iOS prompts for notifications → **Allow**
- **Expect:** bell turns solid primary blue, red badge disappears
- Verify in DB later: row in `push_subscriptions` with your `device_hash`

### Step 3 — Update a stall's status (no join needed)
- Bottom nav → **UPDATE**
- Toggle a stall from "unknown" → "available"
- **Expect:**
  - First report → "Pending consensus (1/2)" banner or similar
  - Second independent device (your second phone or friend's) toggles same → status flips to green
  - Or 10-min fallback applies alone (log will note "time-based fallback")
- Failure → feedback bubble

### Step 4 — Join the queue
- Station page → **Join Queue**
- Location prompt → **Allow** (first time)
- Expect geofence check: you're within 200m → passes
- Plate entry → tap **Scan with Camera** → OCR the plate (or type manually)
- Pick a spot on the aerial photo
- Submit
- **Expect:**
  - Redirect to `/s/ea-7leaves/queue`
  - Your position shown (likely #1 if nobody else is queued)
  - Live queue list shows you with masked plate `ABC***`

### Step 5 — Simulate a stall opening (needs two devices or a friend)
- From device #2 (or ask a friend): on their **UPDATE** page, toggle a stall to `available`
- From device #1 (you) or device #3, independently report same stall `available` (consensus threshold)
- **Expect:**
  - Worker picks up the stall change via Postgres LISTEN
  - Your first device (in queue) receives a web push: "It's your turn!"
  - Tap the push → opens YourTurnView with 3-min countdown + stall assignment
- Failure modes to watch for:
  - Push doesn't arrive (iOS: check Settings → Notifications → PlugQueue)
  - Countdown doesn't start from server's `notified_at`

### Step 6 — Confirm you're plugging in
- On YourTurnView tap **Confirm**
- **Expect:** status goes to "charging", you leave the queue cleanly

### Step 7 — Alternative: let it expire
- Repeat Step 4 (join with a second plate or clear data first)
- This time, when the push arrives, **ignore it**
- **Expect:**
  - At 2-min mark: reminder push
  - At 3-min mark: "Spot given away" push + your entry marked `expired`
  - Next person in queue (if any) gets notified

### Step 8 — Leave voluntarily + cooldown
- Join again (Step 4)
- Tap **Leave Queue** before being notified
- **Expect:** cooldown active for 30 min on this plate at this station; join with same plate fails with `COOLDOWN` error
- Verify with a different plate → works (cooldown is per-plate)

---

## ⚠️ Edge cases worth a quick check (2-3 minutes each)

| Try | Should do |
|---|---|
| Join with same plate already in queue | Reject with `DUPLICATE` error |
| Join with same device but different plate | Reject with `SAME_DEVICE_ACTIVE` (prod-only; dev lets it through) |
| Drive 500m away while in queue | Auto-leave (geofence watch) |
| Airplane mode for 30s while in queue | WebSocket reconnects, state resyncs |
| Tap Join Queue from outside geofence | `OUTSIDE_GEOFENCE` error with distance |
| Rate-limit by pressing buttons rapidly | After 30 requests/min per device → 429 |

---

## 🗨️ In-app feedback

Bottom-right floating blue bubble (🗨️) on every page. Tapping opens **FeedbackSheet**:
- **Rating** 1–5 stars
- **Category** dropdown (bug / suggestion / love / confusion / etc.)
- **Comment** free text

Lands in the `feedback` table — I can pull everything you submitted post-trip with:
```sql
SELECT rating, category, comment, page, to_char(created_at,'HH24:MI:SS') AS at
FROM feedback ORDER BY created_at DESC;
```

Alternative for fast "that doesn't work" notes without screenshots: just tap the bubble + type one line + submit. Device hash + current page are attached automatically.

---

## 🧾 What to capture on the trip

Screenshot when something breaks — upload to Notes or Photos. Include:
- The screen at the moment of failure
- The time (iOS status bar)
- Your location relative to the station (at the curb? in the parking lot? inside the cafe?)

If console is accessible (Mac via responsive mode + DevTools), also copy any red console errors.

---

## ✅ Post-trip verification checklist (after you're home)

```bash
# 1. How much traffic did you generate?
docker run --rm postgres:16-alpine psql "$PGURL" -c "
  SELECT count(*) AS after_visit FROM analytics_events;
  SELECT to_char(created_at,'HH24:MI') AS minute, count(*) AS events
  FROM analytics_events
  WHERE created_at > NOW() - INTERVAL '2 hours'
  GROUP BY 1 ORDER BY 1;
"

# 2. Did the full join funnel succeed?
docker run --rm postgres:16-alpine psql "$PGURL" -c "SELECT * FROM join_funnel;"

# 3. Any uncaught errors?
docker run --rm postgres:16-alpine psql "$PGURL" -c "
  SELECT event_name, properties, page, to_char(created_at,'HH24:MI:SS') AS at
  FROM analytics_events WHERE event_type='error'
  ORDER BY created_at DESC;
"

# 4. Your in-app feedback
docker run --rm postgres:16-alpine psql "$PGURL" -c "
  SELECT rating, category, comment, page, to_char(created_at,'HH24:MI:SS') AS at
  FROM feedback ORDER BY created_at DESC;
"

# 5. Push subscriptions created
docker run --rm postgres:16-alpine psql "$PGURL" -c "
  SELECT left(device_hash,12) AS dev, substring(endpoint for 50) AS endpoint_preview
  FROM push_subscriptions;
"

# 6. Queue entries across the session
docker run --rm postgres:16-alpine psql "$PGURL" -c "
  SELECT plate_display, status, left(device_hash,12) AS dev,
         to_char(joined_at,'HH24:MI:SS') AS joined,
         to_char(notified_at,'HH24:MI:SS') AS notified
  FROM queue_entries ORDER BY joined_at DESC;
"
```

Set `PGURL` once:
```bash
export PGURL='postgres://postgres:CaFABFEGBC635dd3C6FfbEfdEACb6baE@roundhouse.proxy.rlwy.net:12878/railway'
```

---

## 📊 Or just look at the dashboard

**https://plugqueue-web.vercel.app/dashboard** — everything above is visualized there too. Refresh after you're home and the cron has run (up to 5 min delay for `daily_stats`).

---

## 🚨 If something is broken during the visit

Priority order to get unblocked:
1. **Can't reach the app** → Railway api down. `curl /health` from phone's Safari URL bar (type in `https://plugqueue-production.up.railway.app/health`).
2. **Page loads but data won't fetch** → CORS or env var. Screenshot the console if you have a Mac.
3. **Push never arrives** → PWA not installed, OR notification permission not granted. iOS Settings → Notifications → PlugQueue.
4. **Location stuck** → Settings → Safari → Location → Allow.
5. **Anything else** → tap the feedback bubble, type it, submit. It's captured.

Everything is recoverable from the analytics pipeline. Don't panic if something fails — the failure itself is data.

---

## Key URLs (save to phone)

- App: **https://plugqueue-web.vercel.app**
- Station page: https://plugqueue-web.vercel.app/s/ea-7leaves
- Dashboard: https://plugqueue-web.vercel.app/dashboard
- Api health: https://plugqueue-production.up.railway.app/health
