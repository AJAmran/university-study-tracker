import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

/**
 * Liveness probe for ops: verifies the app can reach Postgres.
 * Never leaks internals — 200 {ok:true} or 503 {ok:false}.
 */
export async function GET() {
  const started = Date.now();
  const url = process.env.DATABASE_URL || process.env.DBURL;
  if (!url) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  let pool: Pool | null = null;
  try {
    // pg cannot parse libpq-only params (channel_binding) — strip them like lib/db.ts does.
    let cleaned = url;
    try {
      const u = new URL(url);
      u.searchParams.delete('channel_binding');
      u.searchParams.delete('sslmode');
      cleaned = u.toString();
    } catch {
      cleaned = url.replace(/[?&]channel_binding=[^&]*/gi, '').replace(/[?&]sslmode=[^&]*/gi, '');
    }
    pool = new Pool({
      connectionString: cleaned,
      ssl: process.env.DB_SSL_INSECURE === 'true' ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
      max: 1,
      connectionTimeoutMillis: 8_000,
    });
    await pool.query('select 1');
    return NextResponse.json({ ok: true, latencyMs: Date.now() - started });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  } finally {
    await pool?.end().catch(() => undefined);
  }
}
