import {buildRunAnalysis,analysisFixtureKey,analysisStartTime,isModelLeague,type ModelLeague,type RunModelInput} from './baseball-run-analysis';
import {internationalTeam} from './international-teams';
import type {PregameData} from './international-pregame';

export type ForecastSnapshot={id:string;league:ModelLeague;fixtureKey:string;date:string;startTime:string;capturedAt:string;version:string;payload:{schemaVersion:1;league:ModelLeague;fixtureKey:string;date:string;startTime:string;capturedAt:string;version:string;fixture:{away:string;home:string;starters?:{away?:string;home?:string}};win:{away:number;home:number;draw:number};expectedFinal:{away:number;home:number};inputs:Partial<Record<'away'|'home',RunModelInput>>;sources:{name:string;url:string;observedAt:string}[]}};
export type AuditFinal={key:string;league:ModelLeague;date:string;startTime:string;away:string;home:string;awayScore:number;homeScore:number;observedAt:string};
const validWin=(win:any)=>win&&['away','home','draw'].every(k=>typeof win[k]==='number'&&Number.isFinite(win[k])&&win[k]>=0&&win[k]<=1)&&Math.abs(win.away+win.home+win.draw-1)<1e-8;
export function createForecastSnapshots(data:PregameData,now=Date.now()):ForecastSnapshot[]{
 if(!isModelLeague(data.league)||!Number.isFinite(now))return [];
 const league=data.league;
 return data.games.flatMap(g=>{
  // Real server capture time only. Never set now from source.observedAt or a final score.
  const start=analysisStartTime(g.start);if(g.date!==data.date||start-now<60000)return [];
  const r=buildRunAnalysis(g,now,league);if(r.status!=='ready'||!r.grids||!validWin(r.win))return [];
  const capturedAt=new Date(now).toISOString(),startTime=new Date(start).toISOString(),fixtureKey=analysisFixtureKey(r.fixture,league);
  const id=JSON.stringify([league,fixtureKey,r.version,Math.floor(now/900000)]);
  const expectedFinal=r.grids.full.reduce((n,o)=>({away:n.away+o.away*o.p,home:n.home+o.home*o.p}),{away:0,home:0});
  const sources=[g.source,...(g.comparisonSource?[g.comparisonSource]:[])];
  for(const side of ['away','home'] as const){const t=g[side];if(t.starter.source)sources.push({...g.source,...t.starter.source});if(t.gameLogs)sources.push({...g.source,name:'逐場比賽日誌',url:t.gameLogs.sourceUrl,observedAt:t.gameLogs.observedAt});}
  const payload:ForecastSnapshot['payload']={schemaVersion:1,league,fixtureKey,date:g.date,startTime,capturedAt,version:r.version,fixture:r.fixture,win:r.win!,expectedFinal,inputs:r.inputs,sources:sources.map(s=>({name:s.name,url:s.url,observedAt:s.observedAt}))};
  return [{id,league,fixtureKey,date:g.date,startTime,capturedAt,version:r.version,payload}];
 });
}
export function auditFinalFromLive(game:any,now=Date.now()):AuditFinal|null{
 if(!isModelLeague(game?.league)||game.status!=='final'||game.sourceStale||game.away?.name===game.home?.name)return null;
 if(![game.away?.score,game.home?.score].every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=100))return null;
 const observed=Date.parse(game.source?.fetchedAt),start=Date.parse(game.startTime);
 if(!Number.isFinite(observed)||observed>now||!Number.isFinite(start)||observed<start||!/^\d{4}-\d{2}-\d{2}$/.test(game.date||''))return null;
 return {key:game.key,league:game.league,date:game.date,startTime:new Date(start).toISOString(),away:internationalTeam(game.away.name,game.league),home:internationalTeam(game.home.name,game.league),awayScore:game.away.score,homeScore:game.home.score,observedAt:new Date(observed).toISOString()};
}
export function summarizeForecasts(snapshots:ForecastSnapshot['payload'][],finals:AuditFinal[],now=Date.now()){
 const latest=new Map<string,ForecastSnapshot['payload']>();let rejected=0;
 for(const s of snapshots){
  const at=Date.parse(s.capturedAt),start=Date.parse(s.startTime);
  if(s.schemaVersion!==1||!isModelLeague(s.league)||!Number.isFinite(at)||!Number.isFinite(start)||at>now||at>start-60000||!validWin(s.win)||!s.fixture?.away||!s.fixture?.home||s.fixture.away===s.fixture.home){rejected++;continue;}
  const expectedKey=JSON.stringify([s.league,start,internationalTeam(s.fixture.away,s.league),internationalTeam(s.fixture.home,s.league)]);
  if(s.fixtureKey!==expectedKey||!s.inputs?.away||!s.inputs?.home||Object.values(s.inputs).some(t=>[t!.starterObservedAt,t!.teamObservedAt,...(t!.bullpenMode!=='team_defense'?[t!.bullpenObservedAt]:[])].some(time=>!Number.isFinite(Date.parse(time))||Date.parse(time)>at||at-Date.parse(time)>36*3600000))){rejected++;continue;}
  const key=JSON.stringify([s.league,s.fixtureKey,s.version]);const old=latest.get(key);
  if(!old||Date.parse(old.capturedAt)<at)latest.set(key,s);
 }
 const unique=new Map<string,AuditFinal>(),conflicts=new Set<string>();
 for(const g of finals){
  const key=JSON.stringify([g.league,g.date,g.away,g.home,g.startTime]);const old=unique.get(key);
  if(old&&old.observedAt===g.observedAt&&(old.awayScore!==g.awayScore||old.homeScore!==g.homeScore))conflicts.add(key);
  if(!old||old.observedAt<g.observedAt){unique.set(key,g);conflicts.delete(key);}
 }
 const groups=new Map<string,{league:ModelLeague;version:string;captured:number;pending:number;ambiguous:number;rows:{date:string;p:number[];y:number;scoreError:number}[]}>();
 for(const s of latest.values()){
  const key=JSON.stringify([s.league,s.version]);if(!groups.has(key))groups.set(key,{league:s.league,version:s.version,captured:0,pending:0,ambiguous:0,rows:[]});const group=groups.get(key)!;group.captured++;
  const matchKey=JSON.stringify([s.league,s.date,s.fixture.away,s.fixture.home,s.startTime]);
  const g=unique.get(matchKey);
  if(conflicts.has(matchKey)){group.ambiguous++;continue;}
  if(!g||Date.parse(g.observedAt)>now||Date.parse(g.startTime)<=Date.parse(s.capturedAt)){group.pending++;continue;}
  const y=g.awayScore>g.homeScore?0:g.homeScore>g.awayScore?1:2;
  const scoreError=[s.expectedFinal?.away,s.expectedFinal?.home].every(n=>typeof n==='number'&&Number.isFinite(n))?(Math.abs(s.expectedFinal.away-g.awayScore)+Math.abs(s.expectedFinal.home-g.homeScore))/2:NaN;
  group.rows.push({date:s.date,p:[s.win.away,s.win.home,s.win.draw],y,scoreError});
 }
 return {selection:'每場、每模型版本，開賽前至少 60 秒的最後一筆已保存預測；每 15 分鐘一筆。',rejected,groups:[...groups.values()].map(({rows,...g})=>{
  const n=rows.length,brier=n?rows.reduce((a,r)=>a+r.p.reduce((s,p,i)=>s+(p-Number(r.y===i))**2,0),0)/n:null,logLoss=n?-rows.reduce((a,r)=>a+Math.log(Math.max(1e-15,r.p[r.y])),0)/n:null;
  return {...g,evaluated:n,brier,logLoss,accuracy:n?rows.filter(r=>r.p.indexOf(Math.max(...r.p))===r.y).length/n:null,finalScoreMAE:n&&rows.every(r=>Number.isFinite(r.scoreError))?rows.reduce((a,r)=>a+r.scoreError,0)/n:null,from:rows.map(r=>r.date).sort()[0]||null,to:rows.map(r=>r.date).sort().at(-1)||null,productionCalibrated:false};
 })};
}
