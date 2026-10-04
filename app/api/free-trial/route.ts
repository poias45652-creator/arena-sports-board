import {trialDay,onTrialDay,dailyTrialPick,trialProbabilities,trialResult,retainTrialProgress,type TrialProgress,type TrialData,type TrialFixture} from '@/lib/free-trial';
import {GET as baseballSource} from '../baseball/route';
import {POST as baseballAnalysis} from '../analysis/route';
import {isPregame,type Match} from '@/lib/baseball';
import {winnerAnalysis} from '@/lib/winner-analysis';
import {teamZh} from '@/app/zh';
import {nbaSchedule,nbaGameAnalysis} from '@/lib/nba-source';
import {wnbaSchedule,wnbaGameAnalysis} from '@/lib/wnba-source';
import {FOOTBALL_LEAGUES,type FootballLeague} from '@/lib/football';
import {footballSchedule,footballGameAnalysis} from '@/lib/football-source';
import {getInternationalLive,getInternationalPregame} from '@/lib/international-feed';
import {buildRunAnalysis,analysisStartTime} from '@/lib/baseball-run-analysis';
import {getRawDb} from '@/db';
export const dynamic='force-dynamic';
type Candidate=TrialFixture&{raw:any;eligible:boolean;progress:TrialProgress};
type Saved={fixture_key:string;fixture:string;forecast:string|null;progress:string|null};
let cached:{day:string;until:number;data:TrialData}|undefined;
let pending:{day:string;task:Promise<TrialData>}|undefined;
const json=async(r:Response)=>{if(!r.ok)throw Error('source');return r.json();};
const numeric=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?String(Math.round(n*100)/100):'—';
const score=(n:unknown)=>typeof n==='number'&&Number.isInteger(n)&&n>=0?n:null;
function progress(state:TrialProgress['state'],home:unknown,away:unknown,observedAt:string,label='',settleable=true):TrialProgress{
 return {state,home:state==='scheduled'?null:score(home),away:state==='scheduled'?null:score(away),observedAt,label:label||({scheduled:'未開賽',live:'比賽進行中',final:'已完賽',postponed:'延賽',cancelled:'取消',suspended:'暫停',other:'賽事狀態待確認'}[state]),settleable};
}
const specialState=(label:string):TrialProgress['state']=>/POSTPON|延賽/i.test(label)?'postponed':/CANCEL|取消/i.test(label)?'cancelled':/SUSPEND|DELAY|暫停|中斷/i.test(label)?'suspended':'other';
async function candidates(day:string,league?:string){
 const jobs:Promise<Candidate[]>[]=[];
 if(!league||league==='MLB')jobs.push((async()=>{
  const d=await json(await baseballSource(new Request('https://arena.internal/api/baseball?kind=schedule')));
  return d.games.filter((g:Match)=>onTrialDay(g.date,day)).map((g:Match)=>({key:`MLB:${g.id}`,id:String(g.id),sport:'baseball',league:'MLB',leagueName:'MLB 美國職棒',start:g.date,home:teamZh(g.home),away:teamZh(g.away),homeLogo:`https://www.mlbstatic.com/team-logos/${g.home.id}.svg`,awayLogo:`https://www.mlbstatic.com/team-logos/${g.away.id}.svg`,raw:g,eligible:isPregame(g,Date.now()),progress:progress(g.state==='Final'?'final':g.state==='Live'?'live':g.state==='Preview'&&['Scheduled','Pre-Game','Warmup'].includes(g.status)?'scheduled':specialState(g.status),null,null,d.fetchedAt)}));
 })());
 if(!league||league==='NPB')jobs.push((async()=>{
  const d=await getInternationalLive('NPB',day);if(d.stale||d.status==='unavailable')throw Error('source');
  return d.games.filter((g:any)=>!g.sourceStale&&onTrialDay(g.startTime,day)).map((g:any)=>({key:`NPB:${g.id||g.startTime+g.home.name+g.away.name}`,id:String(g.id||''),sport:'baseball',league:'NPB',leagueName:'NPB 日本職棒',start:g.startTime,home:g.home.name,away:g.away.name,raw:g,eligible:g.status==='pregame'&&Date.parse(g.startTime)>Date.now(),progress:progress(g.status==='pregame'?'scheduled':['live','final','postponed','cancelled','suspended'].includes(g.status)?g.status:'other',g.home.score,g.away.score,g.source.fetchedAt,g.status==='live'&&g.inning?`${g.inning} 局${g.half==='top'?'上':g.half==='bottom'?'下':''}`:'')}));
 })());
 for(const code of ['NBA','WNBA'] as const)if(!league||league===code)jobs.push((async()=>{
  const d=await(code==='NBA'?nbaSchedule:wnbaSchedule)(day);
  return d.games.filter(g=>onTrialDay(g.start,day)).map(g=>({key:`${code}:${g.id}`,id:g.id,sport:'basketball' as const,league:code,leagueName:code,start:g.start,home:g.home.name,away:g.away.name,homeLogo:g.home.logo,awayLogo:g.away.logo,raw:g,eligible:g.state==='scheduled'&&g.timeConfirmed&&Date.parse(g.start)>Date.now(),progress:progress(g.state==='other'?specialState(g.statusLabel):g.state,g.homeScore,g.awayScore,d.fetchedAt,g.statusLabel)}));
 })());
 for(const code of FOOTBALL_LEAGUES)if(!league||league===code.code)jobs.push((async()=>{
  const d=await footballSchedule(code.code,day);
  return d.games.filter(g=>onTrialDay(g.start,day)).map(g=>({key:`${code.code}:${g.id}`,id:g.id,sport:'football' as const,league:code.code,leagueName:code.fullName,start:g.start,home:g.home.name,away:g.away.name,raw:g,eligible:g.state==='scheduled'&&g.timeConfirmed&&Date.parse(g.start)>Date.now(),progress:progress(g.state==='other'?specialState(g.statusName+' '+g.statusLabel):g.state,g.homeScore,g.awayScore,d.fetchedAt,g.statusLabel,!/AET|PEN|EXTRA|加時|延長|點球|PK/i.test(g.statusName+' '+g.statusLabel))}));
 })());
 const results=await Promise.allSettled(jobs);
 return {games:results.flatMap(r=>r.status==='fulfilled'?r.value:[]),failed:results.some(r=>r.status==='rejected')};
}
async function mlbProgress(game:TrialFixture,day:string):Promise<TrialProgress>{
 const d=await json(await baseballSource(new Request(`https://arena.internal/api/baseball?kind=scores&date=${day}`)));
 const g=d.games.find((g:any)=>String(g.gamePk)===game.id);if(!g)throw Error('score unavailable');
 const detail=String(g.status?.detailedState||'');
 const special=specialState(detail);
 const state=special!=='other'?special:g.status?.abstractGameState==='Final'?'final':g.status?.abstractGameState==='Live'?'live':g.status?.abstractGameState==='Preview'?'scheduled':'other';
 const label=state==='live'&&g.linescore?.currentInning?`${g.linescore.currentInning} 局${g.linescore.isTopInning?'上':'下'}`:'';
 return progress(state,g.teams?.home?.score,g.teams?.away?.score,d.fetchedAt,label);
}
async function analyze(chosen:Candidate,day:string):Promise<TrialData>{
 const {raw,...rest}=chosen;
 const {eligible,progress:unused,...game}=rest;
 const data:TrialData={day,status:'ready',game,updatedAt:new Date().toISOString()};
 try{
  if(game.league==='MLB'){
   let report;try{report=await json(await baseballAnalysis(new Request('https://arena.internal/api/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameId:Number(game.id)})})));}catch{}
   const model=winnerAnalysis(raw,report,Date.now(),true);
   if(model.canEstimate&&model.homeWin!==null)data.probabilities=trialProbabilities({home:model.homeWin,away:1-model.homeWin});
   data.details=[{label:'先發投手',home:raw.home.pitcherName||'尚未公布',away:raw.away.pitcherName||'尚未公布'},{label:'先發 ERA',home:numeric(raw.home.pitcherEra),away:numeric(raw.away.pitcherEra)},{label:'先發 WHIP',home:numeric(raw.home.pitcherWhip),away:numeric(raw.away.pitcherWhip)}];
  }else if(game.league==='NPB'){
   const d=await getInternationalPregame('NPB',day),g=d.pregame.games.find((g:any)=>g.home.team===game.home&&g.away.team===game.away&&analysisStartTime(g.start)===Date.parse(game.start));
   if(g){const a=buildRunAnalysis(g,Date.now(),'NPB',true);if(a.status==='ready'&&a.mode!=='simulation'){data.probabilities=trialProbabilities(a.win);if(a.expected)data.expected=a.expected;}data.details=[{label:'先發投手',home:g.home.starter.name||'尚未公布',away:g.away.starter.name||'尚未公布'}];}
  }else{
   const report=game.sport==='football'?await footballGameAnalysis(game.league as FootballLeague,day,game.id):await(game.league==='NBA'?nbaGameAnalysis:wnbaGameAnalysis)(day,game.id);
   const a=report?.analysis;
   if(a?.status==='ready'){data.probabilities=trialProbabilities(a.probabilities);if(a.expected)data.expected={home:a.expected.home,away:a.expected.away};}
   if(a?.homeForm&&a?.awayForm)data.details=[{label:'近期分析場數',home:String(a.homeForm.games),away:String(a.awayForm.games)}];
  }
 }catch{/* Keep the actual selected fixture without inventing missing analysis. */}
 return data;
}
async function build(day:string):Promise<TrialData>{
 const db=getRawDb(),base={day,updatedAt:new Date().toISOString()};
 let saved=await db.prepare('SELECT fixture_key,fixture,forecast,progress FROM free_trial_daily WHERE day=?').bind(day).first<Saved>();
 const storedGame:TrialFixture|undefined=saved?JSON.parse(saved.fixture):undefined;
 // Once selected, only query that competition; source failure never triggers a redraw.
 const pool=await candidates(day,storedGame?.league);
 let prior=await db.prepare('SELECT fixture_key FROM free_trial_selections WHERE day=?').bind(day).first<{fixture_key:string}>();
 let chosen=pool.games.find(g=>g.key===(saved?.fixture_key||prior?.fixture_key));
 if(!saved&&!prior){
  chosen=dailyTrialPick(pool.games.filter(g=>g.eligible),day);
  if(!chosen)return {...base,status:pool.failed?'unavailable':'empty'};
  await db.prepare('INSERT INTO free_trial_selections (day,fixture_key,created_at) VALUES (?,?,?) ON CONFLICT(day) DO NOTHING').bind(day,chosen.key,Date.now()).run();
  prior=await db.prepare('SELECT fixture_key FROM free_trial_selections WHERE day=?').bind(day).first<{fixture_key:string}>();
  chosen=pool.games.find(g=>g.key===prior?.fixture_key);
 }
 if(!saved){
  if(!chosen)return {...base,status:'unavailable'};
  const {raw,eligible,progress:unused,...fixture}=chosen;
  await db.prepare('INSERT INTO free_trial_daily (day,fixture_key,fixture) VALUES (?,?,?) ON CONFLICT(day) DO NOTHING').bind(day,chosen.key,JSON.stringify(fixture)).run();
  saved=await db.prepare('SELECT fixture_key,fixture,forecast,progress FROM free_trial_daily WHERE day=?').bind(day).first<Saved>();
 }
 if(!saved)throw Error('selection persistence failed');
 const game:TrialFixture=JSON.parse(saved.fixture);
 let forecast:TrialData|undefined=saved.forecast?JSON.parse(saved.forecast):undefined;
 let details=forecast?.details;
 // Save the first valid pregame forecast atomically. Never manufacture a pick after kickoff.
 if(!forecast&&chosen?.eligible&&Date.now()<Date.parse(game.start)){
  const report=await analyze(chosen,day);details=report.details;
  const at=Date.now();
  if(report.probabilities&&at<Date.parse(game.start)){
   report.predictionAt=new Date(at).toISOString();
   await db.prepare('UPDATE free_trial_daily SET forecast=? WHERE day=? AND fixture_key=? AND forecast IS NULL').bind(JSON.stringify(report),day,game.key).run();
   const row=await db.prepare('SELECT forecast FROM free_trial_daily WHERE day=?').bind(day).first<{forecast:string|null}>();
   forecast=row?.forecast?JSON.parse(row.forecast):undefined;
  }
 }
 let next=chosen?.progress;
 if(game.league==='MLB')try{next=await mlbProgress(game,day);}catch{next=undefined;}
 const old:TrialProgress|undefined=saved.progress?JSON.parse(saved.progress):undefined;
 const current=retainTrialProgress(old,next);
 if(current&&!current.stale){
  const rank=current.state==='final'?2:current.state==='live'||current.state==='suspended'?1:0;
  await db.prepare(`UPDATE free_trial_daily SET progress=?,progress_at=?,progress_rank=? WHERE day=? AND fixture_key=? AND progress_at<=? AND progress_rank<=?`).bind(JSON.stringify(current),Date.parse(current.observedAt),rank,day,game.key,Date.parse(current.observedAt),rank).run();
 }
 // Read the winning write, including concurrent final-score updates.
 const latest=await db.prepare('SELECT progress FROM free_trial_daily WHERE day=?').bind(day).first<{progress:string|null}>();
 const persisted:TrialProgress|undefined=latest?.progress?JSON.parse(latest.progress):undefined;
 const display=next?retainTrialProgress(persisted,next):persisted?{...persisted,stale:true}:undefined;
 const data:TrialData={...base,status:'ready',game,progress:display||progress('other',null,null,base.updatedAt,'賽事狀態更新中'),probabilities:forecast?.probabilities,expected:forecast?.expected,details:forecast?.details||details,predictionAt:forecast?.predictionAt};
 data.result=trialResult(data);
 return data;
}
export async function GET(){
 const day=trialDay();
 if(cached?.day===day&&cached.until>Date.now())return Response.json(cached.data,{headers:{'Cache-Control':'no-store'}});
 if(!pending||pending.day!==day){const task=build(day);pending={day,task};task.finally(()=>{if(pending?.task===task)pending=undefined;}).catch(()=>{});}
 try{const data=await pending.task;cached={day,until:Date.now()+60000,data};return Response.json(data,{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({day,status:'unavailable',updatedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});}
}
