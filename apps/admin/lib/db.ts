import { Pool } from "pg";

/**
 * Server-only Postgres pool. The admin app talks to the database directly
 * with a privileged connection string (DATABASE_URL) rather than the public
 * anon key the mobile app would use — this file must never be imported from
 * a client component.
 */
declare global {
  // eslint-disable-next-line no-var
  var __taskswiftPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres/Supabase instance.");
  }
  if (!global.__taskswiftPool) {
    global.__taskswiftPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return global.__taskswiftPool;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}
