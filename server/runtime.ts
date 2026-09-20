import {readFile, realpath} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {getRawDb} from '../db';
async function assetFetch(request: Request) {
  const url = new URL(request.url);
  // This adapter is only for the server's bundled Statcast archive reads.
  let path: string;
  try { path = decodeURIComponent(url.pathname); } catch { return new Response(null, {status: 400}); }
  if (!path.startsWith('/history/statcast/') || !path.endsWith('.json')) return new Response(null, {status: 404});
  const root = resolve(process.cwd(), 'public');
  const target = resolve(root, '.' + path);
  if (!target.startsWith(root + sep)) return new Response(null, {status: 404});
  try {
    const resolved = await realpath(target);
    if (!resolved.startsWith(root + sep)) return new Response(null, {status: 404});
    return new Response(await readFile(resolved, 'utf8'), {headers: {'Content-Type': 'application/json'}});
  } catch { return new Response(null, {status: 404}); }
}
export const env = {
  get DB() { return getRawDb(); },
  get TZ_BINDING_KEY() { return process.env.TZ_BINDING_KEY; },
  get BASEBALL_SYNC_TOKEN() { return process.env.BASEBALL_SYNC_TOKEN; },
  ASSETS: {fetch: assetFetch},
};
