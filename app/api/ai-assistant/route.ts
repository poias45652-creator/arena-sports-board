import {getRawDb} from '@/db';
import {readSession} from '@/lib/arena-session';
import {requestOrigin} from '@/lib/request-origin';
import {AI_ACTIONS,AI_INSUFFICIENT,quickAiAnswer,readAiBody,resolveAiSelection,selectAiEvidence,validAiDay,type AiAction} from '@/lib/ai-assistant';
import {consumeAiQuota,readAiSettings} from '@/lib/ai-assistant-settings';
import {AI_LEAGUES,listAiMatches,loadAiSnapshot,validAiLeague} from '@/server/ai-assistant-data';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store',...(status===429?{'Retry-After':'60'}:{})}});
const active=new Set<string>();
let cleanedAt=0;
async function session(request:Request){return readSession(getRawDb(),request.headers.get('cookie'));}
async function quota(member:string,kind:'list'|'question'){
 const db=getRawDb();
 if(Date.now()-cleanedAt>3600000){cleanedAt=Date.now();await db.prepare('DELETE FROM ai_assistant_usage WHERE updated_at<?').bind(Date.now()-2*86400000).run();}
 return consumeAiQuota(db,member,kind);
}
export async function GET(request:Request){
 try{
  const member=await session(request);if(!member)return reply({error:'請先登入星準會員'},401);
  const p=new URL(request.url).searchParams;
  if(p.get('kind')==='status'){const settings=await readAiSettings(getRawDb());return reply({aiEnabled:settings.enabled&&!!settings.key,leagues:AI_LEAGUES});}
  const league=p.get('league'),day=p.get('date');if(!validAiLeague(league)||!validAiDay(day))return reply({error:'請選擇星準聯賽與近期日期'},400);
  if(!await quota(member.memberId,'list'))return reply({error:'查詢較頻繁，請稍後再試'},429);
  return reply({matches:await listAiMatches(league,day)});
 }catch{return reply({error:AI_INSUFFICIENT},503);}
}
export async function POST(request:Request){
 let memberId='';
 try{
  const member=await session(request);if(!member)return reply({error:'請先登入星準會員'},401);
  if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'請從星準站內使用助手'},403);
  let input:any;try{input=await readAiBody(request);}catch{return reply({error:'提問格式錯誤或內容過長'},400);}
  const {league,day,gameId,action,question,settings}=input||{};
  if(!validAiLeague(league)||!validAiDay(day)||typeof gameId!=='string'||!gameId||gameId.length>150)return reply({error:'請先選擇星準場次'},400);
  if(action!==undefined&&!Object.hasOwn(AI_ACTIONS,action))return reply({error:'不支援的提問'},400);
  if(action===undefined&&(typeof question!=='string'||!question.trim()||question.length>600))return reply({error:'請輸入 1 至 600 字的問題'},400);
  // A caller cannot hide arbitrary text behind an approved quick action.
  if(action!==undefined&&question!==undefined)return reply({error:'提問格式錯誤'},400);
  if(active.has(member.memberId)||!await quota(member.memberId,'question'))return reply({error:'請稍後再問，每位會員每日最多 100 次'},429);
  memberId=member.memberId;active.add(memberId);
  let snapshot;try{snapshot=await loadAiSnapshot(league,day,gameId,settings);}catch{return reply({answer:AI_INSUFFICIENT});}
  if(!snapshot)return reply({answer:AI_INSUFFICIENT});
  if(action!==undefined)return reply({...quickAiAnswer(snapshot,action as AiAction),capturedAt:snapshot.capturedAt,mode:'data'});
  const config=await readAiSettings(getRawDb());
  if(!config.enabled||!config.key)return reply({error:'AI 自由提問尚未啟用，可先使用上方快捷分析。'},503);
  const history=Array.isArray(input.history)?input.history.filter((q:unknown)=>typeof q==='string'&&q.length<=600).slice(-4):[];
  let selection;try{selection=await selectAiEvidence(snapshot,question.trim(),history,config.key);}catch{return reply({error:'AI 連線暫時無法使用，請稍後再試。'},502);}
  const result=resolveAiSelection(snapshot,selection);
  return reply({...result,...(result.answer!==AI_INSUFFICIENT?{capturedAt:snapshot.capturedAt}:{}),mode:'ai'});
 }catch{return reply({error:'助手暫時無法連線，請稍後再試。'},503);}
 finally{if(memberId)active.delete(memberId);}
}
