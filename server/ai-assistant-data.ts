import {getRawDb} from '@/db';
import {aiDay,type AiMatch,type AiSnapshot,type AiEvidence,type AiAction} from '@/lib/ai-assistant';
import {fixtureEvidence,teamHistoryEvidence,withFixtureEvidence} from '@/lib/ai-fixture-evidence';
import {fresh,isPregame} from '@/lib/baseball';
import {buildAiFacts} from '@/lib/ai-assistant-facts';
import {aiTeamSuggestion} from './ai-team-suggestions';
import {inningsOuts} from '@/lib/pregame-analysis';
import {FOOTBALL_LEAGUES,isFootballLeague} from '@/lib/football';
import {footballModelCatalog} from '@/lib/football-model-catalog';
import {defaultFootballSettings,parseFootballSettings,validateFootballSettings} from '@/lib/football-model-weights';
import {defaultBaseballSettings,parseBaseballSettings} from '@/lib/baseball-model-settings';
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
 if(league==='MLB')return {id:String(g.id),league,day,home:teamZh(g.home),away:teamZh(g.away),homeId:String(g.home.id),awayId:String(g.away.id),start:g.date};
 if(league==='NPB')return {id:String(g.id),league,day,home:g.home.team,away:g.away.team,homeId:g.home.teamCode,awayId:g.away.teamCode,start:g.start.replace(' ','T')+'+08:00'};
 return {id:String(g.id),league,day,home:g.home.name,away:g.away.name,homeId:String(g.home.id),awayId:String(g.away.id),start:g.start};
}
function buildSnapshot(match:AiMatch,analysis:any,kind:'baseball'|'basketball'|'football'){
 return buildAiFacts(match,analysis,aiTeamSuggestion(match,analysis,kind),kind);
}
// Only existing website providers are reachable. Never accept client facts or URLs.
export async function listAiMatches(league:string,day:string):Promise<AiMatch[]>{
 let games:any[];
 if(league==='MLB'){const {loadSource}=await import('@/app/api/analysis/source');games=(await loadSource('schedule')).games||[];}
 else if(league==='NPB'){const {getInternationalPregame}=await import('@/lib/international-feed');games=(await getInternationalPregame('NPB',day)).pregame?.games||[];}
 else games=(await sportRequest(league,day,'schedule')).games||[];
 return games.map(g=>matchOf(g,league,day)).filter(g=>aiDay(g.start)===day).slice(0,40);
}
export async function loadAiSnapshot(league:string,day:string,id:string,rawSettings:unknown,action?:AiAction):Promise<AiSnapshot|null>{
 const now=Date.now();
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
  const projection=mlbInningProjection(g,runs,settings);
  const model=mlbSelectedWinner(retained?report.game:g,report,retained?Date.parse(report.capturedAt):Date.now(),retained||Date.now()-Date.parse(schedule.fetchedAt)<120000,settings,'moneyline',projection,mlbRunsFresh(runs,'',Date.now()));
  const match=matchOf(g,league,day),official=retained?report.game:g;
  const facts:AiEvidence[]=[];
  if(retained||(isPregame(g,Date.now())&&fresh(schedule.fetchedAt,Date.now(),120000))){
   for(const side of ['home','away'] as const){
    const team=official[side];
    if(Number.isInteger(team.wins)&&team.wins>=0&&Number.isInteger(team.losses)&&team.losses>=0)
     facts.push({id:'team-record-'+side,topic:'data',side,text:`MLB 賽前戰績：${match[side]} ${team.wins} 勝、${team.losses} 敗。`});
    if(Number.isInteger(team.pitcherId)&&team.pitcherId>0&&team.pitcherName){
     const stats=[['ERA',team.pitcherEra],['WHIP',team.pitcherWhip]].filter(([,v])=>typeof v==='number'&&Number.isFinite(v)&&v>=0);
     facts.push({id:'starter-record-'+side,topic:'data',side,text:`MLB 賽程列出的${match[side]}預計先發是 ${team.pitcherName}。${stats.map(([label,value])=>`本季 ${label} ${value}`).join('、')}`});
    }
   }
  }
  const capturedAt=retained?report.capturedAt:schedule.fetchedAt;
  if(!model.canEstimate||model.homeWin===null)return withFixtureEvidence(match,null,facts,capturedAt);
  // An innings estimate has no per-factor contributions; explain only its measured projection.
  const snapshot=buildSnapshot(match,{...model,...(model.version==='mlb-personal-innings-v1'&&projection?{modelFamily:'innings',inputs:projection.inputs,expected:projection.runs}:{}),probabilities:{home:model.homeWin,away:1-model.homeWin},capturedAt:report?.capturedAt||schedule.fetchedAt,retained,weightEvidence:Object.fromEntries((['home','away'] as const).map(side=>{
   const source=(retained?report.game:g)[side],context=report?.context?.sides?.[side],rows=context?.recentGames||[],outs=rows.map((r:any)=>inningsOuts(r.innings));
   return [side,{games:typeof source.wins==='number'&&typeof source.losses==='number'?source.wins+source.losses:null,recentStarts:rows.length,starterOuts:source.pitcherOuts??(outs.length&&outs.every((n:any)=>n!==null)?outs.reduce((a:number,b:number)=>a+b,0):null),lineupPA:context?.lineupStatus==='confirmed'&&context.lineup?.length===9&&context.lineup.every((p:any)=>typeof p.pa==='number')?context.lineup.reduce((n:number,p:any)=>n+p.pa,0):null,bullpenCount:context?.bullpen?.length||null}];
  }))},'baseball');
  return withFixtureEvidence(match,snapshot,facts,capturedAt);
 }
 if(league==='NPB'){
  const settings=rawSettings===undefined?defaultBaseballSettings():parseBaseballSettings(rawSettings);if(!settings)return null;
  const {getInternationalPregame}=await import('@/lib/international-feed');
  const data=await getInternationalPregame('NPB',day),g=data.pregame?.games.find((g:any)=>String(g.id)===id&&g.date===day);if(!g)return null;
  const {buildRunAnalysis,internationalMultifactor,analysisStartTime}=await import('@/lib/baseball-run-analysis');
  const analysis=buildRunAnalysis(g,Date.now(),'NPB',false,settings);
  // The board may expose a simulation; the assistant must not treat assumed data as evidence.
  const match=matchOf(g,league,day),facts:AiEvidence[]=[];
  if(g.league==='NPB'&&g.kind==='pregame_snapshot'&&analysisStartTime(g.start)>Date.now()&&
    !g.live&&g.home.team!==g.away.team&&fresh(g.source.observedAt,Date.now(),24*3600000)){
   const measured=internationalMultifactor(g,Date.now(),'NPB',settings.weights.multifactor);
   for(const side of ['home','away'] as const){
    const stats=measured.factors.filter(f=>Number.isFinite(f[side])&&f.name.includes('先發'));
    if(stats.length)facts.push({id:'starter-record-'+side,topic:'data',side,text:`${match[side]}預計先發 ${g[side].starter.name}，${stats.map(f=>f.name+' '+Number(f[side]!.toFixed(2))).join('、')}。`});
   }
  }
  if(analysis.status!=='ready'||!analysis.win)return withFixtureEvidence(match,null,facts,analysis.capturedAt);
  const snapshot=buildSnapshot(match,{...analysis,probabilities:analysis.win,weightEvidence:Object.fromEntries((['home','away'] as const).map(side=>[side,{starterOuts:inningsOuts(g[side].starter.season.innings),bullpenOuts:inningsOuts(g[side].bullpen?.innings)}])),factors:settings.moneyline==='multifactor'?analysis.personalModel?.multifactor.factors:[]},'baseball');
  return withFixtureEvidence(match,snapshot,facts,analysis.capturedAt);
 }
 const football=isFootballLeague(league);
 let settings:unknown;
 if(football){
  const parsed=rawSettings===undefined?defaultFootballSettings():parseFootballSettings(rawSettings);
  if(!parsed||!validateFootballSettings(parsed,footballModelCatalog(league)))return null;
  settings=parsed;
 }else if(league==='NBA'||league==='WNBA'){
  if(rawSettings!==undefined&&(!Array.isArray(rawSettings)||rawSettings.some(v=>typeof v!=='number')))return null;
  settings=parseWeights(rawSettings===undefined?null:(rawSettings as number[]).join(','));
 }else return null;

 // Resolve the selected id from the site's schedule before requesting a summary.
 const schedule=football?await (await import('@/lib/football-source')).footballSchedule(league,day):
  league==='NBA'?await (await import('@/lib/nba-source')).nbaSchedule(day):await (await import('@/lib/wnba-source')).wnbaSchedule(day);
 const g=schedule.games.find(g=>g.id===id&&aiDay(g.start)===day);
 if(!g)return null;
 const match=matchOf(g,league,day),pregame=g.state==='scheduled'&&g.timeConfirmed&&Date.parse(g.start)>Date.now();
 const loadSummary=async()=>{
  if(football)return (await import('@/lib/football-live-source')).footballSummary({league,id,state:g.state});
  return (await import('@/lib/basketball-live-source')).basketballSummary({id,state:g.state},league as 'NBA'|'WNBA');
 };
 const summaryRequest=pregame&&action!=='weights'?loadSummary().catch(()=>null):null;
 const loadFacts=async(row:Awaited<ReturnType<typeof loadSummary>>|null,players?:any)=>{
  const facts=row?fixtureEvidence(match,row.data,row.fetchedAt,Date.now(),players):[];
  if(!pregame||action==='weights'||(action!=='data'&&action!==undefined&&facts.length))return facts;
  const needHistory=!facts.some(f=>f.id==='prior-meetings');
  const sides=(['home','away'] as const).filter(side=>!facts.some(f=>f.id==='recent-'+side)||(side==='home'&&needHistory));
  const profiles=await Promise.allSettled(sides.map(async side=>{
   const team=g[side].id;
   if(football)return (await import('@/lib/football-source')).footballTeamProfile(league,team);
   return league==='NBA'?(await import('@/lib/nba-source')).nbaTeamProfile(team):(await import('@/lib/wnba-source')).wnbaTeamProfile(team);
  }));
  for(const [i,p] of profiles.entries())if(p.status==='fulfilled')facts.push(...teamHistoryEvidence(match,sides[i],p.value,facts));
  return Date.parse(g.start)>Date.now()?facts:[];
 };
 let quickFacts:AiEvidence[]|undefined;
 if(action==='data'&&pregame){
  const row=await summaryRequest;
  quickFacts=await loadFacts(row);
  if(quickFacts.length)return {match,model:'賽前資料',capturedAt:row?.fetchedAt||new Date().toISOString(),evidence:quickFacts,suggestion:null};
 }
 const [result,summary]=await Promise.all([
  sportRequest(league,day,'analysis',id,settings).catch(()=>null),
  summaryRequest
 ]);
 const at=Date.now();
 const analysis=football?readyFootballAnalysis(g as import('@/lib/football').FootballGame,result,at):
  readyNbaAnalysis(g as import('@/lib/nba').NbaGame,result,at);
 const model=analysis?buildSnapshot(match,{...analysis,retained:!!result?.retained},football?'football':'basketball'):null;
 if(!pregame||action==='weights')return model;
 const c=result?.analysis?.playerContext;
 const facts=quickFacts??await loadFacts(summary,c?.status==='applied'&&analysis?c:undefined);
 return withFixtureEvidence(match,model,facts,summary?.fetchedAt||new Date(at).toISOString());
}
