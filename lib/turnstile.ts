export const TURNSTILE_SITE_KEY = '0x4AAAAAAE0JqmkLF68QSRXN';
const hostname = 'arena-sports-board.poias45652.chatgpt.site';
export async function verifyTurnstile(token: unknown, secret: string | undefined, fetcher: typeof fetch = fetch): Promise<boolean> {
 if (!secret || typeof token !== 'string' || !token.length || token.length > 2048) return false;
 try {
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
   method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
   body: new URLSearchParams({secret, response: token}), signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return false;
  const result = await response.json() as {success?: boolean; action?: string; hostname?: string};
  return result.success === true && result.action === 'login' && result.hostname === hostname;
 } catch { return false; }
}
