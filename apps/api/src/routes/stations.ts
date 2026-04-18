import { Hono } from 'hono';
import { pool } from '../lib/db.js';

const app = new Hono();

// GET /api/stations/nearby?lat=...&lng=...&radius=5000
app.get('/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') ?? '0');
  const lng = parseFloat(c.req.query('lng') ?? '0');
  const radius = Math.min(parseInt(c.req.query('radius') ?? '5000'), 50000);

  if (lat === 0 && lng === 0) {
    return c.json({ ok: false, error: 'lat and lng are required' }, 400);
  }

  const { rows } = await pool.query(
    `select s.id, s.name, s.provider, s.address,
            ST_Y(s.location::geometry) as lat,
            ST_X(s.location::geometry) as lng,
            s.geofence_m, s.indoor, s.lot_map_url,
            ST_Distance(s.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance_m,
            (select count(*) from stalls st where st.station_id = s.id and st.current_status = 'available') as available_stalls,
            (select count(*) from stalls st where st.station_id = s.id) as total_stalls,
            (select count(*) from queue_entries qe where qe.station_id = s.id and qe.status = 'waiting') as queue_size
     from stations s
     where ST_DWithin(s.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
     order by distance_m
     limit 20`,
    [lat, lng, radius]
  );

  const stations = rows.map((r) => ({
    id: r.id,
    name: r.name,
    provider: r.provider,
    address: r.address,
    location: { lat: parseFloat(r.lat), lng: parseFloat(r.lng) },
    geofence_m: r.geofence_m,
    indoor: r.indoor,
    lot_map_url: r.lot_map_url,
    distance_m: Math.round(parseFloat(r.distance_m)),
    available_stalls: parseInt(r.available_stalls),
    total_stalls: parseInt(r.total_stalls),
    queue_size: parseInt(r.queue_size),
  }));

  return c.json({ ok: true, data: stations });
});

// GET /api/stations/:id
app.get('/:id', async (c) => {
  const id = c.req.param('id');

  const stationResult = await pool.query(
    `select id, name, provider, address,
            ST_Y(location::geometry) as lat,
            ST_X(location::geometry) as lng,
            geofence_m, indoor, lot_map_url, created_at
     from stations where id = $1`,
    [id]
  );

  if (stationResult.rows.length === 0) {
    return c.json({ ok: false, error: 'Station not found' }, 404);
  }

  const station = stationResult.rows[0];

  const [stallsResult, queueResult] = await Promise.all([
    pool.query(
      'select id, label, connector_type, max_kw, current_status, status_updated_at from stalls where station_id = $1 order by label',
      [id]
    ),
    pool.query(
      `select id, plate_display, spot_id, joined_at, status, notified_at
       from queue_entries
       where station_id = $1 and status in ('waiting', 'notified')
       order by joined_at asc`,
      [id]
    ),
  ]);

  const availableStalls = stallsResult.rows.filter(
    (s) => s.current_status === 'available'
  ).length;

  // Rough ETA: 20 min per car ahead
  const queueSize = queueResult.rows.length;
  const estimatedWait = queueSize > 0 ? queueSize * 20 : null;

  return c.json({
    ok: true,
    data: {
      id: station.id,
      name: station.name,
      provider: station.provider,
      address: station.address,
      location: { lat: parseFloat(station.lat), lng: parseFloat(station.lng) },
      geofence_m: station.geofence_m,
      indoor: station.indoor,
      lot_map_url: station.lot_map_url,
      created_at: station.created_at,
      stalls: stallsResult.rows,
      queue: queueResult.rows.map((q) => ({
        ...q,
        plate: q.plate_display, // already masked at insert time
      })),
      queue_size: queueSize,
      available_stalls: availableStalls,
      total_stalls: stallsResult.rows.length,
      estimated_wait_min: estimatedWait,
    },
  });
});

export default app;
