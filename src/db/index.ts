import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

const TRANSIENT_PG_CODES = new Set([
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ECONNREFUSED',
]);

export function isTransientPgConnectionError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || err.errno || '').toUpperCase();
  if (code && TRANSIENT_PG_CODES.has(code)) {
    return true;
  }
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes('connection terminated unexpectedly') ||
    msg.includes('connection terminated') ||
    msg.includes('terminating connection due to administrator command') ||
    msg.includes('server closed the connection unexpectedly') ||
    msg.includes('client has encountered a connection error') ||
    msg.includes('connection ended unexpectedly') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up')
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createPool = () => {
  if (!global._postgresPool) {
    const pool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    pool.on('error', (err) => {
      if (isTransientPgConnectionError(err)) {
        // Cloud SQL scale-to-zero or idle proxy recycle drops idle sockets; pg-pool evicts them automatically
        console.warn('[SQL Pool] Idle client disconnected and recycled:', err?.message || 'connection closed');
        return;
      }
      console.error('Unexpected error on idle SQL pool client:', err?.message || err);
    });

    // Transparently retry auto-commit pool.query() calls when a stale idle connection is dropped
    const originalQuery = pool.query.bind(pool);
    (pool as any).query = function retryablePoolQuery(...args: any[]) {
      const lastArg = args[args.length - 1];
      if (typeof lastArg === 'function') {
        return (originalQuery as any)(...args);
      }

      const maxAttempts = 3;
      const runAttempt = async (attempt: number): Promise<any> => {
        try {
          return await (originalQuery as any)(...args);
        } catch (err: any) {
          if (attempt < maxAttempts && isTransientPgConnectionError(err)) {
            await wait(200 * attempt);
            return runAttempt(attempt + 1);
          }
          throw err;
        }
      };

      return runAttempt(1);
    };

    // Transparently retry pool.connect() calls during Cloud SQL wake-up / transient drops
    const originalConnect = pool.connect.bind(pool);
    (pool as any).connect = function retryablePoolConnect(callback?: any) {
      if (typeof callback === 'function') {
        return (originalConnect as any)(callback);
      }

      const maxAttempts = 3;
      const runAttempt = async (attempt: number): Promise<any> => {
        try {
          return await originalConnect();
        } catch (err: any) {
          if (attempt < maxAttempts && isTransientPgConnectionError(err)) {
            await wait(250 * attempt);
            return runAttempt(attempt + 1);
          }
          throw err;
        }
      };

      return runAttempt(1);
    };

    global._postgresPool = pool;
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
