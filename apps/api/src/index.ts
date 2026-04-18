import type { Server } from 'http';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { serve } from '@hono/node-server';
import pino from 'pino';
import stationsRouter from './routes/stations.js';
import queueRouter from './routes/queue.js';
import statusRouter from './routes/status.js';
import pushRouter from './routes/push.js';
import telemetryRouter from './routes/telemetry.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { redis } from './lib/redis.js';
import { setupWebSocket } from './ws/handler.js';
import { startNotificationTimer } from './lib/notificationTimer.js';

const logger = pino({ name: 'api' });
const isProduction = process.env.NODE_ENV === 'production';

const app = new Hono();

// Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.)
app.use('*', secureHeaders());

// CORS — fail closed in production: require explicit origin
const corsOrigin = process.env.CORS_ORIGIN;
if (isProduction && !corsOrigin) {
  logger.error('CORS_ORIGIN must be set in production');
  process.exit(1);
}
app.use(
  '*',
  cors({
    origin: corsOrigin ?? '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'x-device-hash'],
  })
);

// Health check (no rate limit)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Rate limit ALL /api/* routes (device hash + IP)
app.use('/api/*', rateLimitMiddleware);

// Routes
app.route('/api/stations', stationsRouter);
app.route('/api/queue', queueRouter);
app.route('/api/station', statusRouter);
app.route('/api/push', pushRouter);
app.route('/api/telemetry', telemetryRouter);

// Start
const port = parseInt(process.env.PORT ?? '3001');

async function main() {
  // Require Turnstile in production
  if (isProduction && !process.env.TURNSTILE_SECRET_KEY) {
    logger.error('TURNSTILE_SECRET_KEY must be set in production');
    process.exit(1);
  }

  await redis.connect();
  logger.info('Redis connected');

  const server = serve({ fetch: app.fetch, port }, (info) => {
    logger.info(`API server running on port ${info.port}`);
  });

  setupWebSocket(server as Server);
  startNotificationTimer();
}

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
