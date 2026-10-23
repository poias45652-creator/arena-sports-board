import {getRawDb} from '@/db';
import {aiDay,type AiMatch,type AiSnapshot,type AiSuggestion} from '@/lib/ai-assistant';
import {buildAiFacts} from '@/lib/ai-assistant-facts';
import {FOOTBALL_LEAGUES,isFootballLeague} from '@/lib/football';
import {footballModelCatalog} from '@/lib/football-model-catalog';
import {defaultFootballSettings,footballSettingsKey,parseFootballSettings,validateFootballSettings,FOOTBALL_FACTOR_LABELS} from '@/lib/football-model-weights';
import {defaultBaseballSettings,parseBaseballSettings,baseballSettingsKey,BASEBALL_FACTOR_LABELS} from '@/lib/baseball-model-settings';
import {defaultNbaWeights,basketballWeightStorageKey,NBA_WEIGHT_LABELS,writeNbaWeights} from '@/lib/nba-model-weights';
import {parseWeights} from '@/lib/basketball-efficiency';
import {readyNbaAnalysis} from '@/lib/nba-analysis';
import {readyFootballAnalysis} from '@/lib/football-recommendations';
import {teamZh} from '@/app/zh';
export const AI_LEAGUES=[{code:'MLB',name:'MLB 美國職棒'},{code:'NPB',name:'NPB 日本職棒'},{code:'NBA',name:'NBA 美國職籃'},{code:'WNBA',name:'WNBA 美國女子職籃'},...FOOTBALL_LEAGUES];
export const validAiLeague=(value:unknown):value is string=>typeof value==='string'&&AI_LEAGUES.some(l=>l.code===value);
async function json(response:Response){if(!response.ok)throw Error('Analysis unavailable');return response.json();}
async function sportRequest(league:string,day:string,kind:string,id?:string,settings?:unknown){
 const p=new URLSearchParams({date:day,kind});if(id)p.set('game',id);
 if(isFootballLeague(league)){p.set('league',league);if(settings)p.set('settings',JSON.stringify(settings));const {GET}=await import('@/app/api/football/route');return json(await GET(new Request('https://arena.internal/api/football?'+p)));}
 if(settings)p.set('weights',(settings as number[]).join(','));
 const {GET}=league==='WNBA'?await import('@/app/api/wnba/route'):await import('@/app/api/nba/route');
 return json(await GET(new Request('https://arena.internal/api/basketball?'+p)));
}
function matchOf(g:any,league:string,day:string):AiMatch{
 if(league==='MLB')return {id:String(g.id),league,day,home:teamZh(g.home),away:teamZh(g.away),start:g.date};
 if(league==='NPB')return {id:String(g.id),league,day,home:g.home.team,away:g.away.team,start:g.start.replace(' ','T')+'+08:00'};
 return {id:String(g.id),league,day,home:g.home.name,away:g.away.name,start:g.start};
}
export function aiSuggestion(league:string,day:string):AiSuggestion{
 const href=`/?league=${isFootballLeague(league)?'FOOTBALL':league}&view=analysis&date=${day}${isFootballLeague(league)?'&competition='+league:''}`;
 if(league==='MLB'||league==='NPB'){
  const value=defaultBaseballSettings();return {label:'棒球多因子基準配置',storageKey:baseballSettingsKey(league),value,href,weights:Object.entries(value.weights.multifactor).map(([k,v])=>({name:BASEBALL_FACTOR_LABELS[k as keyof typeof BASEBALL_FACTOR_LABELS],value:v}))};
 }
 if(league==='NBA'||league==='WNBA')return {label:'籃球效率基準配置',storageKey:basketballWeightStorageKey(league),value:JSON.parse(writeNbaWeights(defaultNbaWeights())),href,weights:NBA_WEIGHT_LABELS.map(name=>({name,value:20}))};
 const catalog=footballModelCatalog(league as any),active=catalog.models.find(m=>m.id===catalog.active)!;
 return {label:active.name+'基準配置',storageKey:footballSettingsKey(league),value:defaultFootballSettings(),href,weights:active.defaults.map((value,i)=>({name:FOOTBALL_FACTOR_LABELS[i],value})).filter(w=>w.value>0)};
}
// Only existing website providers are reachable. Never accept client facts or URLs.
export async function listAiMatches(league:string,day:string):Promise<AiMatch[]>{
 let games:any[];
 if(league==='MLB'){const {loadSource}=await import('@/app/api/analysis/source');games=(await loadSource('schedule')).games||[];}
 else if(league==='NPB'){const {getInternationalPregame}=await import('@/lib/international-feed');games=(await getInternationalPregame('NPB',day)).pregame?.games||[];}
 else games=(await sportRequest(league,day,'schedule')).games||[];
 return games.map(g=>matchOf(g,league,day)).filter(g=>aiDay(g.start)===day).slice(0,40);
}
export async function loadAiSnapshot(league:string,day:string,id:string,rawSettings:unknown):Promise<AiSnapshot|null>{
 const now=Date.now(),suggestion=aiSuggestion(league,day);
 if(league==='MLB'){
  const settings=rawSettings===undefined?defaultBaseballSettings():parseBaseballSettings(rawSettings);if(!settings)return null;
  const {loadSource}=await import('@/app/api/analysis/source');
  const schedule=await loadSource('schedule'),g=schedule.games?.find((g:any)=>String(g.id)===id&&aiDay(g.date)===day);if(!g)return null;
  let report:any,retained=false;
  if(Date.parse(g.date)<=now){
   const row=await getRawDb().prepare('SELECT payload FROM analysis_snapshots WHERE game_id=? AND start_time=? ORDER BY captured_at DESC LIMIT 1').bind(Number(id),g.date).first();
   if(!row||day!==aiDay(now))return null;report=JSON.parse(row.payload);retained=true;
   if(report.game.id!==g.id||report.game.date!==g.date||report.game.home.id!==g.home.id||report.game.away.id!==g.away.id||Date.parse(report.capturedAt)>=Date.parse(g.date))return null;
   if(settings.moneyline!=='multifactor')return null;
  } else {
   const {POST}=await import('@/app/api/analysis/route');
   try{report=await json(await POST(new Request('https://arena.internal/api/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameId:Number(id)})})));}catch{/* The same public preliminary estimate remains available. */}
  }
  const {mlbInningProjection,mlbSelectedWinner,mlbRunsFresh}=await import('@/lib/mlb-model-analysis');
  const runs=settings.moneyline==='innings'?await loadSource('runs'):null;
  const model=mlbSelectedWinner(retained?report.game:g,report,retained?Date.parse(report.capturedAt):Date.now(),retained||Date.now()-Date.parse(schedule.fetchedAt)<120000,settings,'moneyline',mlbInningProjection(g,runs,settings.weights.innings),mlbRunsFresh(runs,'',Date.now()));
  if(!model.canEstimate||model.homeWin===null)return null;
  // An innings estimate has no per-factor contributions; explain only its measured projection.
  return buildAiFacts(matchOf(g,league,day),{...model,probabilities:{home:model.homeWin,away:1-model.homeWin},capturedAt:report?.capturedAt||schedule.fetchedAt,retained},suggestion,'baseball');
 }
 if(league==='NPB'){
  const settings=rawSettings===undefined?defaultBaseballSettings():parseBaseballSettings(rawSettings);if(!settings)return null;
  const {getInternationalPregame}=await import('@/lib/international-feed');
  const data=await getInternationalPregame('NPB',day),g=data.pregame?.games.find((g:any)=>String(g.id)===id&&g.date===day);if(!g)return null;
  const {buildRunAnalysis}=await import('@/lib/baseball-run-analysis');
  const analysis=buildRunAnalysis(g,Date.now(),'NPB',true,settings);
  // The board may expose a simulation; the assistant must not treat assumed data as evidence.
  if(analysis.status!=='ready'||analysis.mode==='simulation'||!analysis.win)return null;
  return buildAiFacts(matchOf(g,league,day),{...analysis,probabilities:analysis.win,factors:settings.moneyline==='multifactor'?analysis.personalModel?.multifactor.factors:[]},suggestion,'baseball');
 }
 if(isFootballLeague(league)){
  const settings=rawSettings===undefined?defaultFootballSettings():parseFootballSettings(rawSettings);if(!settings||!validateFootballSettings(settings,footballModelCatalog(league)))return null;
  const result=await sportRequest(league,day,'analysis',id,settings),g=result.game;if(!g||aiDay(g.start)!==day)return null;
  const analysis=readyFootballAnalysis(g,result,Date.now());if(!analysis)return null;
  return buildAiFacts(matchOf(g,league,day),{...analysis,retained:!!result.retained},suggestion,'football');
 }
 if(league==='NBA'||league==='WNBA'){
  if(rawSettings!==undefined&&(!Array.isArray(rawSettings)||rawSettings.some(v=>typeof v!=='number')))return null;
  const weights=parseWeights(rawSettings===undefined?null:(rawSettings as number[]).join(','));
  const result=await sportRequest(league,day,'analysis',id,weights),g=result.game;if(!g||aiDay(g.start)!==day)return null;
  const analysis=readyNbaAnalysis(g,result,Date.now());if(!analysis)return null;
  return buildAiFacts(matchOf(g,league,day),analysis,suggestion,'basketball');
 }
 return null;
}
