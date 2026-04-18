import pg from 'pg';
import pino from 'pino';

const logger = pino({ name: 'db' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error(err, 'Unexpected pool error');
});

export { pool };

// Dedicated client for LISTEN/NOTIFY
export async function createListenClient() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  return client;
}
