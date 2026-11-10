import type {Database} from '../db';
import {credentialKey,decryptToken} from './tz-credentials';
import {platformIdentity,tableAccess} from './platform-access';
import {requestOrigin} from './request-origin';

const reply=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
export async function openBaccaratGame(request:Request,db:Database,fetcher=fetch) {
  if(request.method!=='POST'||request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({message:'請從星準會員入口操作'},403);
  try{
    const {platform}=await request.json().catch(()=>({}));
    if(platform!=='DG'&&platform!=='MT')return reply({message:'無效的平台'},400);
    const member=await platformIdentity(db,request.headers.get('cookie'));
    if(!member)return reply({message:'星準登入已到期，請回會員入口登入'},401);
    if(!member.canCheckTable||!(await tableAccess(member.username)).allowed)return reply({message:'尚未取得百家樂授權'},403);
    const row=await db.prepare('SELECT encrypted_token FROM tz_bindings WHERE member_id=? AND lower(username)=lower(?) AND expires_at>?').bind(member.memberId,member.username,Date.now()).first();
    if(!row)return reply({message:'平台授權已到期，請回會員入口登入'},401);
    const key=await credentialKey(process.env.TZ_BINDING_KEY||'');
    const token=await decryptToken(String(row.encrypted_token),member.memberId,key);
    const ofa=member.memberId.startsWith('ofa:');
    const issuer=ofa?'https://www.ofa1188.net':'https://www.tz6868.com';
    const launch=ofa
      ? {game_return_url:issuer,game_kind:'LIVE',game_device:'Desktop',game_money:''}
      : {game_return_url:'https://www.tz6868.cc',game_kind:'',game_type:'',game_device:'Desktop',...(platform==='MT'?{device:'Desktop'}:{})};
    const r=await fetcher(issuer+'/api/v2/game/'+(platform==='DG'?'DGLI':'MTLI')+'/login',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(launch),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(18000)});
    const data=await r.json().catch(()=>null);
    if(r.status===401||Number(data?.code)===401)return reply({message:'平台授權已失效，請回會員入口登入'},401);
    if(!r.ok||!data||(data.code!=null&&Number(data.code)!==200))return reply({message:platform+' 暫時無法開啟遊戲，請稍後重試'},502);
    for(const value of [data.data?.game_url,data.data?.url,data.raw?.url,data.raw?.game_url,data.raw]){
      if(typeof value!=='string')continue;
      let url:URL;try{url=new URL(value.trim().replace(/\\\//g,'/').replace(/^["']|["']$/g,''));}catch{continue;}
      if(url.protocol!=='https:'||url.username||url.password||!Array.from(url.searchParams).some(([k,v])=>k.toLowerCase()==='token'&&v))continue;
      if(platform==='MT'&&!['gsa.ofalive99.net','gs1.ofalive99.net'].includes(url.hostname))continue;
      return reply({gameUrl:url.href},200);
    }
    return reply({message:platform+' 尚未提供有效的遊戲網址'},502);
  }catch{return reply({message:'目前無法取得遊戲授權，請稍後再試'},503);}
}
