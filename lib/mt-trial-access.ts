import {getPool} from '../server/database.mjs';
import {canonicalGuestIp,createTrialLedger} from './mt-trial-limit';
import {launchMtTrial,mtTrialConfigured} from './mt-trial';
import {trialIdentity,trialReply} from './mt-trial-accounts';
import {requestOrigin} from './request-origin';

const headers = {'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const config = () => ({enabled:process.env.OFA_MT_TRIAL_ENABLED,password:process.env.OFA_MT_TRIAL_PASSWORD});
const ledger = createTrialLedger({query:(sql,args) => getPool().query(sql,args)});
const reply = (data:object, status=200) => Response.json(data,{status,headers});
const screenOrigin='https://xingzhun-mt-trial-screen.onrender.com';
type Lease=Awaited<ReturnType<typeof ledger>>;
type TrialUser=NonNullable<Awaited<ReturnType<typeof trialIdentity>>>;
export const currentTrialUser=(request:Request)=>trialIdentity(getPool(),request);
const loginNeeded=()=>trialReply({message:'請先登入 MT 試玩帳號。'},401);
async function prepareScreen(user:TrialUser,ip:string,url:string,lease:Lease,room:string|null=null,lobby=false){
  const key=process.env.MT_SCREEN_KEY;
  if(!key)throw Error('Missing screen configuration');
  const active=lease.state==='active';
  const response=await fetch(screenOrigin+'/v2/sessions',{method:'POST',headers:{
    Authorization:'Bearer '+key,'Content-Type':'application/json'
  },body:JSON.stringify({ip,account:user.id,subject:user.session,url,room,lobby,active,remaining:active?Math.min(600,(lease.expiresAt!-lease.serverNow)/1000):600,expiresAt:active?lease.expiresAt:null}),
    signal:AbortSignal.timeout(40000),cache:'no-store',redirect:'error'});
  if(!response.ok)throw Error('Screen unavailable');
  const {id}=await response.json();
  if(typeof id!=='string'||!/^[a-f0-9]{48}$/.test(id))throw Error('Invalid screen');
  return screenOrigin+'/s/'+id;
}

const expired = '這組帳號的試玩已結束，結束後 24 小時可再次試玩。';

export async function guestTrial(request:Request, start:boolean) {
  if (start && (request.method !== 'POST' || request.headers.get('origin') !== requestOrigin(request) ||
    request.headers.get('sec-fetch-site') === 'cross-site')) return reply({message:'請從星準試玩頁開啟。'},403);
  const ip = canonicalGuestIp(request.headers);
  try {
    const user=await currentTrialUser(request);
    if(!user)return loginNeeded();
    const current = await ledger(user.id,false);
    if (current.state === 'expired') return reply({...current,message:expired},410);
    if (!start) return reply(current);
    if (request.headers.get('x-mt-trial') !== 'account-600') return reply({message:'試玩頁已更新，請重新整理後開始。'},426);
    if(!ip)return reply({message:unavailable},503);
    if (!mtTrialConfigured(config())) return reply({message:'MT 試玩尚未啟用。'},503);
    // Do not consume an unused account when the upstream grant fails. Recheck the
    // database after slow logins so a request cannot finish beyond its deadline.
    const response = await launchMtTrial(request,config());
    if (!response.ok) return response;
    const {gameUrl} = await response.json();
    // Open the isolated table before consuming an unused guest's first minute.
    // No upstream token is sent to the visitor, including table navigations.
    const toolsOnly=request.headers.get('x-mt-view')==='watch';
    if(!toolsOnly) {
      try { await prepareScreen(user,ip,gameUrl,current); }
      catch { return reply({toolsAvailable:true,message:current.state==='unused'
        ?'原廠真人牌桌目前無法接通，本次尚未開始計時。你也可以選擇只試用星準牌路工具。'
        :'原廠真人牌桌目前無法接通，可繼續使用星準牌路工具。'},503); }
    }
    if((await currentTrialUser(request))?.session!==user.session)return loginNeeded();
    const lease = await ledger(user.id,true);
    if (lease.state !== 'active') return reply({...lease,message:expired},410);
    if(!toolsOnly)await prepareScreen(user,ip,gameUrl,lease);
    return reply({...lease,gameOrigin:new URL(gameUrl).origin});
  } catch {
    return reply({message:'暫時無法核對試玩時間，請稍後再試。'},503);
  }
}

// A table navigation, including reloading a table iframe, checks the database
// independently of the outer UI. Only the active guest can load the provider.
export async function activeGameGrant(request:Request) {
  const ip=canonicalGuestIp(request.headers);
  if(!ip) return reply({message:unavailable},503);
  try {
    const user=await currentTrialUser(request);
    if(!user)return loginNeeded();
    const before=await ledger(user.id,false);
    if(before.state!=='active')return reply({...before,message:before.state==='expired'?expired:'請先開始試玩。'},before.state==='expired'?410:403);
    const origin=requestOrigin(request);
    const internal=new Request(origin+'/mt-trial/launch',{method:'POST',headers:{origin}});
    const grant=await launchMtTrial(internal,config());
    if(!grant.ok)return grant;
    const {gameUrl}=await grant.json();
    if((await currentTrialUser(request))?.session!==user.session)return loginNeeded();
    const lease=await ledger(user.id,false);
    if(lease.state!=='active')return reply({...lease,message:expired},410);
    return {url:new URL(gameUrl),lease,ip,user};
  }catch{return reply({message:unavailable},503);}
}
const unavailable='暫時無法核對試玩連線。';

export async function guestTable(request:Request) {
  if(request.headers.get('sec-fetch-dest')!=='iframe')return reply({message:'請在星準試玩牌桌內開啟。'},403);
  const room=new URL(request.url).searchParams.get('game');
  if(room && !/^BAV(?:0[1235](?:_LIVE)?|03A(?:_LIVE)?|0[6789]|10)$/.test(room))return reply({message:'桌號無效。'},400);
  const grant=await activeGameGrant(request);
  if(grant instanceof Response)return grant;
  try {
    const screen=await prepareScreen(grant.user,grant.ip,grant.url.href,grant.lease,room,!room);
    return new Response(null,{status:302,headers:{...headers,Location:screen}});
  } catch {return reply({message:'MT 試玩牌桌暫時無法接通，請稍後再試。'},503);}
}
