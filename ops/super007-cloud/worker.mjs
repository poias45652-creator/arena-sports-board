// Deploy in the user's Cloudflare account. Bind a KV namespace as ODDS.
const SOURCE='https://super007.net/api/GameInfo/GameDetail';
const MAX_AGE=150000;
export async function run(env){
 if(!env.ODDS)throw new Error('Bind KV namespace as ODDS');
 const started=Date.now();let success=false;
 try{
  let snapshot;
  for(let attempt=0;attempt<2;attempt++){
   try{
    if(!env.SUPER007_HEADERS)throw new Error('source_authorization_missing');
    const r=await fetch(SOURCE,{method:'POST',headers:JSON.parse(env.SUPER007_HEADERS),body:JSON.stringify({GameType:3,CatID:101,WagerTypeKey:1,show:0}),redirect:'manual',signal:AbortSignal.timeout(25000)});
    if(!r.ok)throw new Error('source_unavailable');
    const d=await r.json();
    if(String(d.code)!=='200'||!Array.isArray(d.data?.List))throw new Error('source_authorization_or_format');
 const games=d.data.List.filter((l)=>l.LeagueNameStr==='MLB 美國職棒').flatMap((l)=>(l.Team||[]).map((t)=>({id:t.EvtID,home:t.HomeTeamStr,away:t.AwayTeamStr,start:t.ScheduleTimeStr,live:!!t.Live,markets:(t.Wager||[]).filter((w)=>w.WagerGrpID===10&&[103,104,111].includes(w.WagerTypeID)).map((w)=>({type:w.WagerTypeID,quotes:(w.Odds||[]).map((o,index)=>({...o,primary:index===0})).filter((o)=>o.Status===1).map((o)=>({primary:o.primary,id:o.GameID,homeLine:o.HomeHdp||'',awayLine:o.AwayHdp||'',total:o.OULine||'',homePrice:o.HomeHdpOdds??o.HomeOdds??null,awayPrice:o.AwayHdpOdds??o.AwayOdds??null,over:o.OverOdds??null,under:o.UnderOdds??null}))}))})));
    snapshot={games,fetchedAt:new Date().toISOString(),source:'Super007'};
    const age=Date.now()-Date.parse(snapshot?.fetchedAt);
    if(snapshot.source!=='Super007'||!Array.isArray(snapshot.games)||!Number.isFinite(age)||age< -60000||age>MAX_AGE)throw new Error('source_stale');
    break;
   }catch(e){if(attempt===1)throw e;await new Promise(resolve=>setTimeout(resolve,1000));}
  }
  await env.ODDS.put('latest',JSON.stringify(snapshot));success=true;
 }finally{
  // Keep two days of timestamped outcomes, never store credentials or error bodies.
  await env.ODDS.put(`run:${started}:${success?'ok':'error'}`,JSON.stringify({startedAt:new Date(started).toISOString(),success}),{expirationTtl:172800});
 }
}
export default {
 async scheduled(_event,env,ctx){ctx.waitUntil(run(env));},
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method!=='GET')return reply({error:'method_not_allowed'},405);
  if(!env.ODDS)return reply({error:'請先綁定 ODDS 儲存空間'},503);
  if(!['/odds','/health','/'].includes(path))return reply({error:'not_found'},404);
  const snapshot=await env.ODDS.get('latest','json');
  const age=Date.now()-Date.parse(snapshot?.fetchedAt),fresh=Number.isFinite(age)&&age>=-60000&&age<=MAX_AGE;
  if(path==='/odds')return fresh?reply(snapshot):reply({error:'盤口尚未取得或已過期',games:[],fetchedAt:snapshot?.fetchedAt||null},503);
  const recent=[];let cursor;
  do{const page=await env.ODDS.list({prefix:'run:',limit:1000,...(cursor?{cursor}:{})});recent.push(...page.keys.map(k=>k.name));cursor=page.list_complete?undefined:page.cursor;}while(cursor);
  const events=recent.map(k=>{const [,time,result]=k.split(':');return {time:Number(time),result};}).filter(e=>e.time>=Date.now()-86400000).sort((a,b)=>a.time-b.time);
  const gaps=events.slice(1).map((e,i)=>e.time-events[i].time);
  return reply({fresh,lastFetchedAt:snapshot?.fetchedAt||null,games:snapshot?.games?.length||0,last24Hours:{attempts:events.length,success:events.filter(e=>e.result==='ok').length,failed:events.filter(e=>e.result==='error').length,observedHours:events.length?(events.at(-1).time-events[0].time)/3600000:0,maxGapSeconds:gaps.length?Math.max(...gaps)/1000:null},note:'排程必須另行啟用；少量成功不代表完成全天驗證。'});
 }
};
