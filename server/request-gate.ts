import {readSession} from '../lib/arena-session';
export async function gateRequest(request: Request, db: any): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === '/api/health' || path === '/api/session' ||
      (path === '/api/international-sync' && request.method === 'POST')) return null;
  const protectedPage = path === '/' || path === '/admin' || path.startsWith('/admin/') ||
    path === '/teams' || path.startsWith('/teams/') || path.startsWith('/players/');
  if (!protectedPage && !path.startsWith('/api/')) return null;
  try {
    if (await readSession(db, request.headers.get('cookie'))) return null;
    return path.startsWith('/api/')
      ? Response.json({error:'請重新登入；帳號可能尚未授權、已停用或到期'}, {status:401,headers:{'Cache-Control':'private, no-store'}})
      : new Response(null, {status:307,headers:{Location:new URL('/login',process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL||request.url).href,'Cache-Control':'private, no-store'}});
  } catch {
    return Response.json({error:'登入服務暫時無法使用，請稍後重試'}, {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
