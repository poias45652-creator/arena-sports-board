import {credentialKey,decryptToken,encryptToken} from './tz-credentials';
import {parseHrGameDetail} from './hr9988';
import type {SuperSnapshot} from './super007';

type Statement={bind(...values:unknown[]):Statement;first<T=any>():Promise<T|null>;run():Promise<unknown>};
export type HrDatabase={prepare(sql:string):Statement};
type Binding={member_id:string;encrypted_token:string;expires_at:number;verified_at:number;game_url:string|null};
type Connection={binding_version:number;encrypted_session:string|null;snapshot:string|null;fetched_at:number|null;last_error:string|null;error_code:string|null;busy_until:number;operation_id:string};
type Session={origin:string;loginID:string;mbID:string};
export class HrError extends Error{constructor(public code:string,message:string,public status=502){super(message);}}
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers});
const allowedHosts=new Set(['hr9988.net','www.hr9988.net','m.hr9988.net']);
const authCodes=new Set([-101,-102,-105]);
const text=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<16384&&!/[\r\n]/.test(v);
function hrOrigin(url:URL){if(url.protocol!=='https:'||!allowedHosts.has(url.hostname)||url.port||url.username||url.password)throw new HrError('wrong_game_destination','tz 回傳的體育館不是允許的 SUPER 網址，尚未連接。');return url.origin;}
async function post(url:string,body:unknown,extra:Record<string,string>,fetcher:typeof fetch):Promise<any>{
 let r:Response;
 try{r=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',...extra},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(8000),cache:'no-store'});}
 catch{throw new HrError('source_unreachable','來源連線逾時或中斷，請稍後再試。');}
 if(r.status===401)throw new HrError('source_auth_expired','來源授權已失效，需要重新連接。');
 if(r.status===403)throw new HrError('source_access_denied','來源拒絕 Arena 的連線，尚未取得可用盤口。');
 if(!r.ok)throw new HrError('source_unavailable','來源暫時無法提供資料，請稍後再試。');
 let raw='',size=0;const reader=r.body?.getReader(),decoder=new TextDecoder();
 if(!reader)throw new HrError('source_format_changed','來源沒有回傳有效資料。');
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();throw new HrError('source_too_large','來源資料量超出本次可處理範圍。');}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
 let result:any;try{result=JSON.parse(raw);}catch{throw new HrError('source_format_changed','來源回傳的資料格式無法辨識。');}
 if(authCodes.has(Number(result?.code)))throw new HrError('source_auth_expired','SUPER 登入授權已失效，需要重新連接。');
 if(String(result?.code)!=='200')throw new HrError('source_rejected','來源未接受請求，請確認帳號的體育館權限或重新驗證 tz。');
 return result;
}
async function openSession(binding:Binding,key:CryptoKey,fetcher:typeof fetch):Promise<Session>{
 const token=await decryptToken(binding.encrypted_token,binding.member_id,key);
 let launched:any;
 try{launched=await post('https://www.tz6868.com/api/v2/game/SUPER/login',{game_return_url:'https://www.tz6868.cc',game_kind:'',game_type:'',game_device:'Desktop'},{Authorization:`Bearer ${token}`},fetcher);}
 catch(e){if(e instanceof HrError&&e.code==='source_auth_expired')throw new HrError('tz_auth_expired','tz 授權已失效，請重新驗證 tz 帳號。',409);if(e instanceof HrError)throw new HrError(e.code,'tz 體育館登入：'+e.message,e.status);throw e;}
 const data=launched.data;
 if(data?.game_method!=='GET'||typeof data?.game_url!=='string'||data.game_url.length>4096)throw new HrError('launch_format_changed','tz 未回傳可辨識的體育館登入入口。');
 let url:URL;try{url=new URL(data.game_url);}catch{throw new HrError('launch_format_changed','tz 回傳的體育館網址無效。');}
 const origin=hrOrigin(url),fragment=url.hash.slice(1),split=fragment.indexOf('?');
 if(url.pathname!=='/'||url.search||fragment.slice(0,split)!=='/APILogin')throw new HrError('launch_format_changed','tz 回傳的體育館登入格式已改變。');
 const params=new URLSearchParams(fragment.slice(split+1)),memID=params.get('MemID');
 if(params.getAll('MemID').length!==1||!memID||!/^[a-f0-9]{32}$/i.test(memID))throw new HrError('launch_format_changed','tz 未回傳有效的體育館登入憑證。');
 let exchanged:any;
 try{exchanged=await post(origin+'/api/mb/sin/outApiLogin',{MemID:memID},{SSSLANG:'tw'},fetcher);}catch(e){if(e instanceof HrError)throw new HrError(e.code,'SUPER 登入：'+e.message,e.status);throw e;}
 const loginID=exchanged.data?.loginID,mbID=exchanged.data?.mb?.mbID;
 if(!text(loginID)||!text(mbID))throw new HrError('exchange_format_changed','SUPER 登入回應缺少會員授權，尚未連接。');
 return {origin,loginID,mbID};
}
async function collect(session:Session,fetcher:typeof fetch):Promise<SuperSnapshot>{
 hrOrigin(new URL(session.origin));if(!text(session.loginID)||!text(session.mbID))throw new HrError('source_auth_expired','保存的 SUPER 授權無效，請重新連接。');
 let raw:any;
 try{raw=await post(session.origin+'/api/GameInfo/GameDetail',{GameType:3,CatID:888888,WagerTypeKey:888888},{SSSLANG:'tw',SSSToken:session.loginID,SSSMBID:session.mbID},fetcher);}catch(e){if(e instanceof HrError)throw new HrError(e.code,'SUPER 盤口：'+e.message,e.status);throw e;}
 try{return parseHrGameDetail(raw,new Date().toISOString());}catch{throw new HrError('odds_format_changed','SUPER 盤口格式改變，暫停推薦。');}
}
function publicStatus(row:Connection|null,binding:Binding){
 if(binding.expires_at<=Date.now())return {status:'expired',message:'tz 授權已到期，請重新驗證。'};
 if(!row||row.binding_version!==binding.verified_at)return {status:'not_connected',message:'尚未連接 SUPER 盤口。'};
 const fetchedAt=row.fetched_at?new Date(row.fetched_at).toISOString():null;
 if(row.last_error)return {status:'error',code:row.error_code,message:row.last_error,lastSuccessfulAt:fetchedAt};
 if(!row.snapshot)return {status:row.busy_until>Date.now()?'connecting':'not_connected'};
 const age=Date.now()-(row.fetched_at??0),snapshot=JSON.parse(row.snapshot) as SuperSnapshot;
 return {status:age>=0&&age<=150000?'connected':'stale',fetchedAt,gameCount:snapshot.games.length,message:age<=150000?'SUPER 盤口已取得。':'盤口資料已過期，請更新。'};
}

/** Per-member durable credentials and snapshots. No singleton or shared-member fallback. */
export async function hrConnection(memberId:string|null,db:HrDatabase,secret:string|undefined,mode:'status'|'connect'|'read',fetcher:typeof fetch=fetch):Promise<Response>{
 if(!memberId)return reply({error:'請先登入 Arena，再連接自己的盤口。',code:'signin_required'},401);
 let binding:Binding|null=null,operationId:string|undefined;
 try{
  binding=await db.prepare('SELECT member_id, encrypted_token, expires_at, verified_at, game_url FROM tz_bindings WHERE member_id = ?').bind(memberId).first<Binding>();
  if(!binding)return reply({error:'請先綁定 tz 帳號。',code:'binding_required'},409);
  let row=await db.prepare('SELECT * FROM hr_connections WHERE member_id = ?').bind(memberId).first<Connection>();
  if(mode==='status')return reply(publicStatus(row,binding));
  if(binding.expires_at<=Date.now())throw new HrError('tz_auth_expired','tz 授權已到期，請重新驗證 tz 帳號。',409);
  if(!binding.game_url)throw new HrError('game_url_required','請先設定 SUPER 賽事網址。',409);
  hrOrigin(new URL(binding.game_url));
  if(!secret)throw new HrError('service_unavailable','會員盤口服務尚未就緒。',503);
  const sameVersion=row?.binding_version===binding.verified_at;
  if(mode==='read'&&sameVersion&&row?.snapshot&&!row.last_error&&row.fetched_at&&Date.now()-row.fetched_at>=0&&Date.now()-row.fetched_at<60000)return reply({...JSON.parse(row.snapshot),connection:publicStatus(row,binding)});
  if(mode==='read'&&(!sameVersion||!row?.encrypted_session))throw new HrError('not_connected','請點「連接並讀取盤口」完成 SUPER 連接。',409);
  if(row&&sameVersion&&row.busy_until>Date.now())throw new HrError(row.error_code||'connection_busy',row.last_error||'盤口正在更新，請稍後重試。',429);
  const key=await credentialKey(secret),now=Date.now();operationId=crypto.randomUUID();
  const lease=await db.prepare('INSERT INTO hr_connections (member_id,binding_version,busy_until,operation_id) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM tz_bindings WHERE member_id=? AND verified_at=? AND expires_at>?) ON CONFLICT(member_id) DO UPDATE SET busy_until=excluded.busy_until,operation_id=excluded.operation_id,binding_version=excluded.binding_version WHERE hr_connections.busy_until<=? OR hr_connections.binding_version<>excluded.binding_version RETURNING operation_id').bind(memberId,binding.verified_at,now+45000,operationId,memberId,binding.verified_at,now,now).first();
  if(!lease)throw new HrError('connection_busy','帳號狀態已更新或連線正在進行，請稍後重試。',409);
  let session:Session;
  if(mode==='connect'||!sameVersion||!row?.encrypted_session)session=await openSession(binding,key,fetcher);
  else session=JSON.parse(await decryptToken(row.encrypted_session,memberId+':hr9988',key));
  let snapshot:SuperSnapshot;
  try{snapshot=await collect(session,fetcher);}catch(e){
   if(mode==='read'&&e instanceof HrError&&e.code==='source_auth_expired'){session=await openSession(binding,key,fetcher);snapshot=await collect(session,fetcher);}else throw e;
  }
  const encrypted=await encryptToken(JSON.stringify(session),memberId+':hr9988',key),fetchedAt=Date.parse(snapshot.fetchedAt);
  const saved=await db.prepare('UPDATE hr_connections SET encrypted_session=?,snapshot=?,fetched_at=?,last_error=NULL,error_code=NULL,busy_until=0 WHERE member_id=? AND operation_id=? AND EXISTS (SELECT 1 FROM tz_bindings WHERE member_id=? AND verified_at=? AND expires_at>?) RETURNING operation_id').bind(encrypted,JSON.stringify(snapshot),fetchedAt,memberId,operationId,memberId,binding.verified_at,Date.now()).first();
  if(!saved)throw new HrError('binding_changed','綁定已變更，請重新連接。',409);
  return reply({...snapshot,connection:{status:'connected',fetchedAt:snapshot.fetchedAt,gameCount:snapshot.games.length,message:'SUPER 盤口已取得。'}});
 }catch(e){
  const error=e instanceof HrError?e:new HrError('service_unavailable','會員盤口服務暫時無法使用，請稍後重試。',503);
  if(operationId&&binding){try{await db.prepare('UPDATE hr_connections SET last_error=?,error_code=?,busy_until=? WHERE member_id=? AND operation_id=? AND binding_version=?').bind(error.message,error.code,Date.now()+15000,memberId,operationId,binding.verified_at).run();}catch{}}
  return reply({error:error.message,code:error.code,source:'hr9988',games:[],fetchedAt:null},error.status);
 }
}
