import {readSession,VIEWER_COOKIE} from '../lib/arena-session';
export async function gateRequest(request: Request, db: any): Promise<Response | null> {
  const url=new URL(request.url),path=url.pathname;
  // Evaluate viewer restrictions before all public/machine-route exceptions.
  // Unknown routes and every mutation are denied by default.
  if((request.headers.get('cookie')||'').split(';').some(s=>s.trim().startsWith(VIEWER_COOKIE+'='))&&path!=='/api/session'&&path!=='/login'){
    try{
      const session=await readSession(db,request.headers.get('cookie'));
      if(!session)return path.startsWith('/api/')?Response.json({error:'測試帳號登入已失效，請重新登入'},{status:401,headers:{'Cache-Control':'private, no-store'}}):new Response(null,{status:307,headers:{Location:new URL('/login',process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL||request.url).href,'Cache-Control':'private, no-store'}});
      const reading=request.method==='GET'||request.method==='HEAD';
      const page=path==='/'||path==='/free-trial'||path==='/teams'||path.startsWith('/teams/')||path.startsWith('/players/');
      const api=['/api/health','/api/free-trial','/api/daily-win-rate','/api/baseball','/api/international','/api/international-live','/api/international-team','/api/npb-player','/api/nba','/api/wnba','/api/football','/api/football-team','/api/football-player-photo','/api/team','/api/player','/api/sport-player','/api/viewer-analysis'].includes(path);
      const custom=['settings','refresh','force','action'].some(k=>url.searchParams.has(k))||(url.searchParams.has('mode')&&url.searchParams.get('mode')!=='stored')||(url.searchParams.has('weights')&&url.searchParams.get('weights')!=='20,20,20,20,20'&&url.searchParams.get('weights')!=='0.2,0.2,0.2,0.2,0.2');
      const privateSource=path==='/api/baseball'&&url.searchParams.get('kind')==='super007';
      if(reading&&(page||api)&&!custom&&!privateSource)return null;
      // Viewing never exchanges or refreshes upstream membership credentials.
      if(reading&&path==='/api/member-odds')return Response.json({games:[],internationalGames:[],fetchedAt:null,readOnly:true,error:'唯讀測試帳號不提供 SUPER 連線'},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
      return Response.json({error:'此帳號僅供觀看，無法使用此功能',code:'view_only'},{status:403,headers:{'Cache-Control':'private, no-store'}});
    }catch{return Response.json({error:'登入服務暫時無法使用，請稍後重試'},{status:503,headers:{'Cache-Control':'no-store'}});}
  }
  if (path === '/api/health' || path === '/api/session' || path === '/api/free-trial' || (path === '/api/daily-win-rate' && request.method === 'GET') ||
      (path === '/api/international-sync' && request.method === 'POST')) return null;
  const protectedPage = path === '/' || path === '/ai-assistant' || path === '/admin' || path.startsWith('/admin/') ||
    path === '/teams' || path.startsWith('/teams/') || path.startsWith('/players/');
  if (!protectedPage && !path.startsWith('/api/')) return null;
  try {
    if (await readSession(db, request.headers.get('cookie'))) return null;
    return path.startsWith('/api/')
      ? Response.json({error:'請重新登入；帳號可能尚未授權、已停用或到期'}, {status:401,headers:{'Cache-Control':'private, no-store'}})
      : new Response(null, {status:307,headers:{Location:new URL(path==='/'&&!url.searchParams.has('league')&&!url.searchParams.has('view')?'/welcome':'/login',process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL||request.url).href,'Cache-Control':'private, no-store'}});
  } catch {
    return Response.json({error:'登入服務暫時無法使用，請稍後重試'}, {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
