import {createHash,createHmac} from 'node:crypto';
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
function guestKey(db: Executor) {
  let secret: Promise<string> | undefined;
  return async (address: string) => {
    secret ??= db.query('SELECT secret FROM mt_guest_ip_secret WHERE singleton')
      .then(result => {
        if (!result.rows[0]?.secret) throw Error('Missing MT guest key');
        return String(result.rows[0].secret);
      }).catch(error => { secret = undefined; throw error; });
    return createHmac('sha256', await secret).update('mt-guest-ip\0' + address).digest('hex');
  }
}

export const TRIAL_SECONDS = 600;
export const COOLDOWN_SECONDS = 86400;

export function createTrialLedger(db: Executor) {
  const key = guestKey(db);
  return async (address: string, start: boolean) => {
    const ipKey = await key(address);
    if (start) {
      await db.query(`INSERT INTO mt_guest_ip_trials (ip_key, expires_at)
        VALUES ($1, statement_timestamp() + $2 * interval '1 second')
        ON CONFLICT (ip_key) DO UPDATE
        SET expires_at=EXCLUDED.expires_at, retry_ready=false
        WHERE mt_guest_ip_trials.retry_ready OR
          mt_guest_ip_trials.expires_at + $3 * interval '1 second' <= statement_timestamp()`, [ipKey, TRIAL_SECONDS, COOLDOWN_SECONDS]);
    }
    const {rows} = await db.query(`SELECT
      floor(extract(epoch from statement_timestamp()) * 1000)::bigint AS now,
      (SELECT ceil(extract(epoch from expires_at) * 1000)::bigint
       FROM mt_guest_ip_trials WHERE ip_key=$1 AND NOT retry_ready) AS expires`, [ipKey]);
    const serverNow = Number(rows[0].now);
    const end = rows[0].expires == null ? null : Number(rows[0].expires);
    if (!Number.isSafeInteger(serverNow) || (end !== null && !Number.isSafeInteger(end))) throw Error('Invalid trial clock');
    const unlockAt = end === null ? null : end + COOLDOWN_SECONDS * 1000;
    const state = end === null || serverNow >= unlockAt! ? 'unused' : serverNow < end ? 'active' : 'expired';
    return {state, expiresAt: state === 'unused' ? null : end, unlockAt: state === 'unused' ? null : unlockAt, serverNow} as const;
  };
}

export function createRetestClaim(db: Executor) {
  const key = guestKey(db);
  return async (address: string, code: string) => {
    if (!/^[a-f0-9]{64}$/.test(code)) return false;
    const args = [createHash('sha256').update(code).digest('hex'), await key(address)];
    const {rows} = await db.query(`WITH claimed AS (
      UPDATE mt_guest_trial_retests SET claimed_by=$2
      WHERE token_hash=$1 AND claimed_by IS NULL RETURNING claimed_by
    ), armed AS (
      UPDATE mt_guest_ip_trials t SET retry_ready=true FROM claimed
      WHERE t.ip_key=claimed.claimed_by AND t.expires_at<=statement_timestamp()
    ) SELECT EXISTS(SELECT 1 FROM claimed) AS ok`, args);
    if (rows[0].ok) return true;
    const prior = await db.query('SELECT 1 FROM mt_guest_trial_retests WHERE token_hash=$1 AND claimed_by=$2',args);
    return prior.rows.length > 0;
  };
}
