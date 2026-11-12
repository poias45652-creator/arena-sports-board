import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';

export function canonicalGuestIp(headers: Headers): string | null {
  // Render's public Cloudflare ingress overwrites this value. Never fall back
  // to the client-supplied prefix of X-Forwarded-For or a shared placeholder.
  const address = headers.get('cf-connecting-ip')?.trim();
  if (!address || address.includes('%') || !isIP(address)) return null;
  if (isIP(address) === 4) return address;
  const ip = new URL('http://[' + address + ']').hostname.slice(1,-1);
  const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(ip);
  if (!mapped) return ip;
  return mapped.slice(1).flatMap(word => {
    const value = parseInt(word,16);
    return [value >>> 8, value & 255];
  }).join('.');
}

type Executor = {query(sql: string, values?: any[]): Promise<{rows: any[]}>};
export function createTrialLedger(db: Executor) {
  let secret: Promise<string> | undefined;
  async function key(address: string) {
    secret ??= db.query('SELECT secret FROM mt_guest_ip_secret WHERE singleton')
      .then(result => {
        if (!result.rows[0]?.secret) throw Error('Missing MT guest key');
        return String(result.rows[0].secret);
      }).catch(error => { secret = undefined; throw error; });
    return createHmac('sha256', await secret).update('mt-guest-ip\0' + address).digest('hex');
  }
  return async (address: string, start: boolean) => {
    const ipKey = await key(address);
    if (start) {
      // A conflict cannot move the original deadline, even across processes.
      await db.query(`INSERT INTO mt_guest_ip_trials (ip_key,expires_at)
        VALUES ($1, clock_timestamp() + interval '180 seconds')
        ON CONFLICT (ip_key) DO NOTHING`, [ipKey]);
    }
    const {rows} = await db.query(`SELECT
      floor(extract(epoch from clock_timestamp()) * 1000)::bigint AS now,
      (SELECT floor(extract(epoch from expires_at) * 1000)::bigint
       FROM mt_guest_ip_trials WHERE ip_key=$1) AS expires`, [ipKey]);
    const serverNow = Number(rows[0].now);
    const expiresAt = rows[0].expires == null ? null : Number(rows[0].expires);
    if (!Number.isSafeInteger(serverNow) || (expiresAt !== null && !Number.isSafeInteger(expiresAt))) throw Error('Invalid trial clock');
    return {state: expiresAt === null ? 'unused' : expiresAt > serverNow ? 'active' : 'expired', expiresAt, serverNow} as const;
  };
}
