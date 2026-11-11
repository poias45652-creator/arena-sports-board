import {loginExpiry} from './tz-credentials';
import {requestOrigin} from './request-origin';

const ACCOUNT='dvp0322';
const ISSUER='https://www.ofa1188.net';
const hosts=new Set(['gsa.ofalive99.net','gs1.ofalive99.net']);
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
type Config={enabled?:string;password?:string};
const reply=(message:string,status:number)=>Response.json({message},{status,headers});
export function mtTrialConfigured(config:Config){return config.enabled==='true'&&!!config.password;}
export function mtTrialGameUrl(data:any):string|null{
 for(const value of [data?.data?.game_url,data?.data?.url,data?.raw?.url,data?.raw?.game_url,data?.raw]){
  if(typeof value!=='string')continue;
  try{const url=new URL(value.trim().replace(/\\\//g,'/').replace(/^["']|["']$/g,''));
   if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&hosts.has(url.hostname)&&Array.from(url.searchParams).some(([k,v])=>k.toLowerCase()==='token'&&v))return url.href;
  }catch{}
 }
 return null;
}
// An isolated game credential, never a member/admin session. No browser cookies
// or tokens from arena_sessions/tz_bindings are read, created or returned here.
export function createMtTrialService(fetcher:typeof fetch=fetch,clock=Date.now){
 let token='',tokenUntil=0,gameUrl='',gameUntil=0,pending:Promise<Response>|null=null,retryAt=0;
 const device=crypto.randomUUID().replaceAll('-','');
 let priorPassword='';
 async function launch(config:Config,returnUrl:string):Promise<Response>{
  const now=clock();
  if(now<retryAt)return reply('測試服務暫時忙碌，請稍後再試。',503);
  try{
   if(config.password!==priorPassword){token='';tokenUntil=0;gameUrl='';gameUntil=0;priorPassword=config.password||'';}
   if(tokenUntil<=now+60000){
    token='';gameUrl='';gameUntil=0;
    const r=await fetcher(ISSUER+'/api/v1/login',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({username:ACCOUNT,password:config.password,device_id:device}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
    const d=await r.json().catch(()=>null);
    if(!r.ok||String(d?.code)!=='200'||d?.data?.username?.toLowerCase()!==ACCOUNT||typeof d?.data?.token!=='string')throw Error('trial-login');
    tokenUntil=loginExpiry(d.data.token,now);token=d.data.token;
   }
   if(gameUrl&&gameUntil>now)return Response.json({gameUrl,refreshAfter:gameUntil},{headers});
   const r=await fetcher(ISSUER+'/api/v2/game/MTLI/login',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({game_return_url:returnUrl,game_kind:'LIVE',game_device:'Desktop',game_money:''}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(18000)});
   const d=await r.json().catch(()=>null);
   if(r.status===401||Number(d?.code)===401){token='';tokenUntil=0;throw Error('trial-expired');}
   const next=mtTrialGameUrl(d);
   if(!r.ok||(d?.code!=null&&Number(d.code)!==200)||!next)throw Error('trial-game');
   gameUrl=next;gameUntil=Math.min(tokenUntil-60000,now+5*60000);
   return Response.json({gameUrl,refreshAfter:gameUntil},{headers});
  }catch{
   gameUrl='';gameUntil=0;retryAt=clock()+30000;
   // Never include upstream responses, request bodies, credentials or stack traces.
   return reply('MT 測試遊戲暫時無法連線，請稍後重新連接。',503);
  }
 }
 return async(request:Request,config:Config)=>{
  if(request.method!=='POST')return reply('不支援此操作。',405);
  if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply('請從星準試玩頁開啟。',403);
  if(!mtTrialConfigured(config)){token='';tokenUntil=0;gameUrl='';gameUntil=0;priorPassword='';return reply('共用試玩尚未啟用，請聯絡管理員完成設定。',503);}
  // Single-flight login avoids duplicate logins when visitors arrive together.
  if(!pending)pending=launch(config,requestOrigin(request)+'/mt-trial').finally(()=>{pending=null;});
  return (await pending).clone();
 };
}
export const launchMtTrial=createMtTrialService();
