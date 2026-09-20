import pg from 'pg';
import {readFile} from 'node:fs/promises';
export const DATABASE_SCHEMA = 'yj_platform_v1';
pg.types.setTypeParser(20, value => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Database integer exceeds supported range');
  return n;
});
// D1 returns serialized JSON; keep the same application-level contract.
pg.types.setTypeParser(114, value => value);
pg.types.setTypeParser(3802, value => value);
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  if (!globalThis.__yjPlatformPool) {
    const url = new URL(process.env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid database URL');
    const internal = /\.internal$/.test(url.hostname) || /^dpg-[a-z0-9-]+$/.test(url.hostname);
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
    globalThis.__yjPlatformPool = new pg.Pool({
      connectionString: url.href, max: 5, connectionTimeoutMillis: 10000,
      options: `-c search_path=${DATABASE_SCHEMA},pg_catalog`,
      ssl: local || internal || process.env.PGSSLMODE === 'disable' ? false : {rejectUnauthorized: true},
    });
  }
  return globalThis.__yjPlatformPool;
}
export function postgresSql(input) {
  let sql = input.replace(/;\s*$/, '');
  sql = sql.replace(/json_extract\((\w+(?:\.\w+)?),'\$\.([^']+)'\)/g,
    (_, field, path) => `jsonb_extract_path(${field}::jsonb,${path.split('.').map(x => `'${x}'`).join(',')})`);
  sql = sql.replace(/\bjson_object\(/g, 'jsonb_build_object(');
  sql = sql.replace(/strftime\('%Y-%m-%dT%H:%M:%fZ',start_time,'-60 seconds'\)/g,
    `to_char((start_time::timestamptz - interval '60 seconds') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`);
  const ignore = /^\s*INSERT OR IGNORE INTO\b/i.test(sql);
  sql = sql.replace(/^\s*INSERT OR IGNORE INTO\b/i, 'INSERT INTO');
  // Quote camelCase aliases, which PostgreSQL would otherwise lowercase.
  sql = sql.replace(/\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/gi, (all, alias) => /[A-Z]/.test(alias) ? `AS "${alias}"` : all);
  let i = 0;
  sql = sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g, token => token === '?' ? '$' + (++i) : token);
  return sql + (ignore ? ' ON CONFLICT DO NOTHING' : '');
}
const result = r => ({success: true, results: r.rows, meta: {changes: r.rowCount ?? 0}});
export function createDatabase(executor = getPool()) {
  class Statement {
    constructor(sql, values = []) { this.sql = postgresSql(sql); this.values = values; }
    bind(...values) { return new Statement(this.sql, values); }
    async first(column) { const row = (await executor.query(this.sql, this.values)).rows[0] ?? null; return column ? row?.[column] ?? null : row; }
    async all() { return result(await executor.query(this.sql, this.values)); }
    async run() { return result(await executor.query(this.sql, this.values)); }
  }
  return {
    prepare: sql => new Statement(sql),
    async batch(statements) {
      const client = await executor.connect();
      try {
        await client.query('BEGIN');
        const results = [];
        for (const statement of statements) results.push(result(await client.query(statement.sql, statement.values)));
        await client.query('COMMIT');
        return results;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
  };
}
export async function migrate(pool = getPool()) {
  const schema = await readFile(new URL('../db/render-schema.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::int,$2::int)', [1095910734, 172]);
    await client.query(schema);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
