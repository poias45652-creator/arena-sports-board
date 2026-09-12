import {validateCollectorSnapshot} from '@/lib/pinnacle';
import {env} from 'cloudflare:workers';
import {SourceError,sourceFailure} from '@/lib/source-errors';
export const dynamic='force-dynamic';
let snapshot:any=null;
let pinnacleReference:unknown=null;
async function updateReference(){try{const r=await fetch('https://arena-odds-service.onrender.com/odds',{signal:AbortSignal.timeout(5000)});if(r.ok)pinnacleReference=validateCollectorSnapshot(await r.json());}catch{pinnacleReference=null;}}
let pending:Promise<any>|null=null;
async function collect(){
 const secret=(env as unknown as Record<string,string>).SUPER007_HEADERS;
 if(!secret)throw new SourceError('authorization_missing','尚未設定 Super007 登入授權，請由管理者重新連接。');
 let headers;try{headers=JSON.parse(secret);}catch{throw new SourceError('authorization_config_invalid','Super007 授權設定格式有誤，請由管理者更新。');}
 const r=await fetch('https://super007.net/api/GameInfo/GameDetail',{method:'POST',headers,body:JSON.stringify({GameType:3,CatID:101,WagerTypeKey:1,show:0}),signal:AbortSignal.timeout(25000),redirect:'manual'});
 if([401,403].includes(r.status))throw new SourceError('source_access_denied','Super007 拒絕存取，請確認登入授權或來源存取限制。');
 if(!r.ok)throw new SourceError('source_unavailable','Super007 暫時無法提供盤口，稍後自動重試。');
 let d:any;try{d=await r.json();}catch{throw new SourceError('source_format_changed','Super007 回傳格式無法辨識，暫停推薦。');}
 if(String(d.code)!=='200')throw new SourceError('source_rejected','Super007 未接受這次資料請求，需核對登入授權與來源狀態。');
 if(!Array.isArray(d.data?.List))throw new SourceError('source_format_changed','Super007 盤口格式改變，暫停推薦。');
 const games=d.data.List.filter((l:any)=>l.LeagueNameStr==='MLB 美國職棒').flatMap((l:any)=>(l.Team||[]).map((t:any)=>({id:t.EvtID,home:t.HomeTeamStr,away:t.AwayTeamStr,start:t.ScheduleTimeStr,live:!!t.Live,markets:(t.Wager||[]).filter((w:any)=>w.WagerGrpID===10&&[103,104,111].includes(w.WagerTypeID)).map((w:any)=>({type:w.WagerTypeID,quotes:(w.Odds||[]).map((o:any,index:number)=>({...o,primary:index===0})).filter((o:any)=>o.Status===1).map((o:any)=>({primary:o.primary,id:o.GameID,homeLine:o.HomeHdp||'',awayLine:o.AwayHdp||'',total:o.OULine||'',homePrice:o.HomeHdpOdds??o.HomeOdds??null,awayPrice:o.AwayHdpOdds??o.AwayOdds??null,over:o.OverOdds??null,under:o.UnderOdds??null}))}))})));
 return {games,fetchedAt:new Date().toISOString(),source:'Super007'};
}
export async function readSource(){
 try{
  if(!snapshot||Date.now()-Date.parse(snapshot.fetchedAt)>=60000){
   if(!pending)pending=Promise.all([collect(),updateReference()]).then(([s])=>{snapshot=s;return s;}).finally(()=>{pending=null;});
   await pending;
  }
  return Response.json(snapshot,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({...sourceFailure(e),games:[],fetchedAt:null,lastSuccessfulAt:snapshot?.fetchedAt??null},{status:502,headers:{'Cache-Control':'no-store'}});}
}

export async function GET(){
 const url=(env as unknown as Record<string,string>).SUPER007_COLLECTOR_URL;
 if(!url)return readSource();
 try{
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw new Error('雲端服務網址設定錯誤');
  const r=await fetch(u,{signal:AbortSignal.timeout(10000),redirect:'manual'});
  if(!r.ok)throw new Error('雲端抓盤服務未就緒或資料過期');
  const d=await r.json() as any,age=Date.now()-Date.parse(d?.fetchedAt);
  if(d.source!=='Super007'||!Array.isArray(d.games)||!Number.isFinite(age)||age< -60000||age>150000)throw new Error('雲端盤口已過期，暫停推薦');
  return Response.json(d,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'雲端讀取失敗',games:[],fetchedAt:null},{status:502,headers:{'Cache-Control':'no-store'}});}
}
