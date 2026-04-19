-- Seed: Electrify America at 7 Leaves Cafe (Milpitas, CA)
-- This is the primary station for the MVP — single-station deployment.

insert into stations (id, name, provider, address, location, geofence_m, indoor)
values (
  'ea-7leaves',
  'Electrify America — 7 Leaves Cafe',
  'Electrify America',
  '540-548 Lawrence Expy, Sunnyvale, CA 94085',
  -- Coords verified on-site at the chargers (Apr 2026):
  --   lat=37.383899, lng=-121.995249. The earlier 37.3884/-121.9915 was
  --   ~600m off (address geocode hit the wrong corner of the plaza).
  ST_SetSRID(ST_MakePoint(-121.995249, 37.383899), 4326)::geography,
  1609, -- 1 mile (≈ 1609 m) — generous to accommodate GPS drift + plaza layout

  false
) on conflict (id) do nothing;

-- 4 stalls along the left edge of the parking lot
insert into stalls (station_id, label, connector_type, max_kw, current_status) values
  ('ea-7leaves', '1', 'CCS / CHAdeMO', 150, 'unknown'),
  ('ea-7leaves', '2', 'CCS / CHAdeMO', 150, 'unknown'),
  ('ea-7leaves', '3', 'CCS',           350, 'unknown'),
  ('ea-7leaves', '4', 'CCS',           350, 'unknown')
on conflict (station_id, label) do nothing;
