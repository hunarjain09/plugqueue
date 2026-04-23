import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { pool, createListenClient } from '../lib/db.js';
import pino from 'pino';

const logger = pino({ name: 'ws' });

// Map of station_id -> Set of WebSocket clients
const stationSubs = new Map<string, Set<WebSocket>>();
// Track connections per IP to prevent abuse
const ipConnections = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 10;
const HEARTBEAT_INTERVAL_MS = 30_000;

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Heartbeat: detect and close dead connections every 30s
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if ((ws as any)._pqAlive === false) {
        ws.terminate();
        continue;
      }
      (ws as any)._pqAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const stationId = url.searchParams.get('station');

    if (!stationId) {
      ws.close(4000, 'Missing station query param');
      return;
    }

    // Per-IP connection limit
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown';
    const currentCount = ipConnections.get(ip) ?? 0;
    if (currentCount >= MAX_CONNECTIONS_PER_IP) {
      ws.close(4008, 'Too many connections');
      return;
    }
    ipConnections.set(ip, currentCount + 1);

    // Heartbeat tracking
    (ws as any)._pqAlive = true;
    ws.on('pong', () => { (ws as any)._pqAlive = true; });

    // Add to station subscribers
    if (!stationSubs.has(stationId)) {
      stationSubs.set(stationId, new Set());
    }
    stationSubs.get(stationId)!.add(ws);

    logger.info({ stationId, clients: stationSubs.get(stationId)!.size, ip }, 'WS connected');

    // Send initial snapshot
    try {
      const [stallsResult, queueResult] = await Promise.all([
        pool.query(
          'select id, label, connector_type, max_kw, current_status, status_updated_at from stalls where station_id = $1 order by label',
          [stationId]
        ),
        pool.query(
          `select id, plate_display, spot_id, waiting_spot_id, joined_at, status, notified_at
           from queue_entries
           where station_id = $1 and status in ('waiting', 'notified')
           order by joined_at asc`,
          [stationId]
        ),
      ]);

      ws.send(
        JSON.stringify({
          type: 'snapshot',
          queue: queueResult.rows.map((q) => ({
            ...q,
            plate: q.plate_display,
          })),
          stalls: stallsResult.rows,
        })
      );
    } catch (err) {
      logger.error(err, 'Failed to send snapshot');
    }

    function cleanupConnection() {
      const count = ipConnections.get(ip) ?? 1;
      if (count <= 1) ipConnections.delete(ip);
      else ipConnections.set(ip, count - 1);
    }

    ws.on('close', () => {
      cleanupConnection();
      stationSubs.get(stationId)?.delete(ws);
      if (stationSubs.get(stationId)?.size === 0) {
        stationSubs.delete(stationId);
      }
    });

    ws.on('error', (err) => {
      cleanupConnection();
      logger.error(err, 'WS error');
      stationSubs.get(stationId)?.delete(ws);
    });
  });

  // Start LISTEN clients for broadcasting
  startListening().catch((err) => {
    logger.error(err, 'Failed to start LISTEN');
    process.exit(1);
  });

  return wss;
}

async function startListening() {
  const client = await createListenClient();

  await client.query('LISTEN queue_changed');
  await client.query('LISTEN stall_changed');

  client.on('notification', async (msg) => {
    if (!msg.payload) return;
    const payload = JSON.parse(msg.payload);
    const stationId = payload.station_id;

    const clients = stationSubs.get(stationId);
    if (!clients || clients.size === 0) return;

    if (msg.channel === 'queue_changed') {
      const { rows } = await pool.query(
        `select id, plate_display, spot_id, joined_at, status, notified_at
         from queue_entries
         where station_id = $1 and status in ('waiting', 'notified')
         order by joined_at asc`,
        [stationId]
      );

      const message = JSON.stringify({
        type: 'queue_update',
        queue: rows.map((q) => ({
          ...q,
          plate: q.plate_display,
        })),
      });

      broadcast(clients, message);
    } else if (msg.channel === 'stall_changed') {
      const message = JSON.stringify({
        type: 'stall_update',
        stall_label: payload.stall_label,
        status: payload.new_status,
      });

      broadcast(clients, message);
    }
  });

  client.on('error', async (err) => {
    logger.error(err, 'LISTEN connection lost, reconnecting...');
    let delay = 1000;
    const maxDelay = 30000;

    while (true) {
      await new Promise((r) => setTimeout(r, delay));
      try {
        await startListening();
        // Broadcast fresh snapshot to all connected clients after reconnect
        for (const [sid, clients] of stationSubs.entries()) {
          if (clients.size === 0) continue;
          const { rows } = await pool.query(
            `select id, plate_display, spot_id, waiting_spot_id, joined_at, status, notified_at
             from queue_entries where station_id = $1 and status in ('waiting', 'notified')
             order by joined_at asc`,
            [sid]
          );
          broadcast(clients, JSON.stringify({
            type: 'queue_update',
            queue: rows.map((q) => ({ ...q, plate: q.plate_display })),
          }));
        }
        logger.info('LISTEN reconnected, snapshots broadcast');
        return;
      } catch (retryErr) {
        logger.error(retryErr, 'LISTEN reconnect failed');
        delay = Math.min(delay * 2, maxDelay);
      }
    }
  });

  logger.info('LISTEN subscriptions active');
}

function broadcast(clients: Set<WebSocket>, message: string) {
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}
