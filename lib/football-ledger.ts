import {footballSelectionAudit} from './football-selection-audit';
import type {Database} from '../db';
import type {FootballAnalysis,FootballGame,FootballLeague} from './football';
import {uncalibratedCupAnalysis} from './football';
import {readyFootballAnalysis,retainFootballForecast,type FootballReport} from './football-recommendations';
import {footballForecastSettingsKey,type FootballModelSettings} from './football-model-weights';

export function validFootballForecast(game:FootballGame,analysis:FootballAnalysis,now=Date.now()){
  if(uncalibratedCupAnalysis(game,analysis))return false;
  const captured=Date.parse(analysis.capturedAt),start=Date.parse(game.start),p=analysis.probabilities;
  return game.state==='scheduled'&&game.timeConfirmed&&analysis.status==='ready'&&!!p&&
    Number.isFinite(start)&&Number.isFinite(captured)&&captured<=now+5000&&now-captured<=120000&&now<start-60000&&captured<start-60000&&
    [p.home,p.draw,p.away,p.over25,p.under25,p.btts].every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&Math.abs(p.home+p.draw+p.away-1)<1e-6&&Math.abs(p.over25+p.under25-1)<1e-6;
}
export async function saveFootballForecast(db:Database,game:FootballGame,analysis:FootballAnalysis,now=Date.now(),settings?:FootballModelSettings){
  if(!validFootballForecast(game,analysis,now))return false;
  const settingsKey=footballForecastSettingsKey(settings);
  const id=[game.league,game.id,game.start,analysis.version].join('|');
  const payload=JSON.stringify({home:game.home,away:game.away,selection:analysis.selection,probabilities:analysis.probabilities,calibration:analysis.calibration?.status,historyMode:analysis.historyMode,homeForm:analysis.homeForm,awayForm:analysis.awayForm,quality:analysis.quality,external:analysis.external,game,analysis});
  // Each version keeps its most recent valid pregame observation. Capture and
  // kickoff checks are server-side; after kickoff there is no rewrite path.
  if(settingsKey){
    // Custom forecasts are kept separately from the public model's accuracy ledger.
    await db.prepare(`INSERT INTO football_custom_forecasts (id,league,game_id,start_time,captured_at,version,settings_key,payload) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET captured_at=excluded.captured_at,payload=excluded.payload WHERE football_custom_forecasts.captured_at<excluded.captured_at`).bind(id+'|'+settingsKey,game.league,game.id,game.start,analysis.capturedAt,analysis.version,settingsKey,payload).run();
  }else{
    await db.prepare(`INSERT INTO football_forecasts (id,league,game_id,start_time,captured_at,version,payload) VALUES (?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET captured_at=excluded.captured_at,payload=excluded.payload WHERE football_forecasts.captured_at<excluded.captured_at`).bind(id,game.league,game.id,game.start,analysis.capturedAt,analysis.version,payload).run();
  }
  return true;
}
export async function loadFootballForecast(db:Database,game:FootballGame,now=Date.now(),settings?:FootballModelSettings):Promise<FootballReport|null>{
  if(!retainFootballForecast(game,now))return null;
  const settingsKey=footballForecastSettingsKey(settings);
  const {results}=await (settingsKey
    ?db.prepare(`SELECT start_time,captured_at,version,payload FROM football_custom_forecasts WHERE league=? AND game_id=? AND start_time=? AND settings_key=? ORDER BY captured_at DESC LIMIT 20`).bind(game.league,game.id,game.start,settingsKey)
    :db.prepare(`SELECT start_time,captured_at,version,payload FROM football_forecasts WHERE league=? AND game_id=? AND start_time=? ORDER BY captured_at DESC LIMIT 20`).bind(game.league,game.id,game.start)).all();
  for(const row of results){
    try{
      const payload=JSON.parse(row.payload),captured=Date.parse(row.captured_at);
      if(!Number.isFinite(captured)||captured>=Date.parse(game.start)-60000||payload.home?.id!==game.home.id||payload.away?.id!==game.away.id)continue;
      // Legacy rows contain probabilities only. Never reconstruct missing score
      // predictions from results or today's model.
      const analysis:FootballAnalysis=payload.analysis??{status:'ready',reason:'',version:row.version,capturedAt:row.captured_at,probabilities:payload.probabilities,homeForm:payload.homeForm,awayForm:payload.awayForm,historyMode:payload.historyMode,quality:payload.quality,external:payload.external,notes:[]};
      if(analysis.capturedAt!==row.captured_at||analysis.version!==row.version)continue;
      const report:FootballReport={game:payload.game??{...game,state:'scheduled',statusName:'STATUS_SCHEDULED',statusLabel:'未開賽',homeScore:null,awayScore:null},analysis,retained:true,snapshotSaved:true,...(settingsKey?{custom:true}:{})};
      if(readyFootballAnalysis(game,report,now))return report;
    }catch{/* Corrupt snapshots are never replaced by postgame calculations. */}
  }
  return null;
}
export async function saveFootballResults(db:Database,games:FootballGame[],now=Date.now()){
  let count=0;
  for(const g of games){
    if(g.state!=='final'||g.statusName!=='STATUS_FULL_TIME'||!Number.isInteger(g.homeScore)||!Number.isInteger(g.awayScore)||g.homeScore!<0||g.awayScore!<0||!Number.isFinite(Date.parse(g.start))||Date.parse(g.start)>=now)continue;
    await db.prepare(`INSERT INTO football_results (id,league,game_id,start_time,home_goals,away_goals,fetched_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET start_time=excluded.start_time,home_goals=excluded.home_goals,away_goals=excluded.away_goals,fetched_at=excluded.fetched_at`).bind(g.league+'|'+g.id,g.league,g.id,g.start,g.homeScore,g.awayScore,new Date(now).toISOString()).run();count++;
  }
  return count;
}
type ProbabilitySet=NonNullable<FootballAnalysis['probabilities']>;
type OutcomeTotals={n:number;logLoss:number;brier:number;accuracy:number;over25Brier:number;bttsBrier:number};
const emptyTotals=():OutcomeTotals=>({n:0,logLoss:0,brier:0,accuracy:0,over25Brier:0,bttsBrier:0});

function scorable(p:ProbabilitySet|undefined):p is ProbabilitySet {
  return !!p&&[p.home,p.draw,p.away,p.over25,p.btts].every(n=>Number.isFinite(n)&&n>=0&&n<=1)
    &&Math.abs(p.home+p.draw+p.away-1)<1e-6;
}
function addOutcome(t:OutcomeTotals,p:ProbabilitySet,home:number,away:number){
  const y=home>away?0:home<away?2:1,values=[p.home,p.draw,p.away];
  t.n++;
  t.logLoss-=Math.log(Math.max(values[y],1e-12));
  t.brier+=values.reduce((sum,n,i)=>sum+(n-Number(i===y))**2,0);
  t.accuracy+=Number(values.indexOf(Math.max(...values))===y);
  t.over25Brier+=(p.over25-Number(home+away>2))**2;
  t.bttsBrier+=(p.btts-Number(home>0&&away>0))**2;
}
function averages(t:OutcomeTotals){
  return {n:t.n,logLoss:t.logLoss/t.n,brier:t.brier/t.n,accuracy:t.accuracy/t.n,
    over25Brier:t.over25Brier/t.n,bttsBrier:t.bttsBrier/t.n};
}
export function summarizeFootballVerification(rows:any[]){
  const groups=new Map<string,{league:string;version:string;totals:OutcomeTotals}>();
  const paired=new Map<string,{league:string;version:string;coverage:string;injuryShiftApplied:boolean;baseline:OutcomeTotals;formOnly:OutcomeTotals;published:OutcomeTotals}>();
  for(const row of rows){
    try{
      const captured=Date.parse(row.captured_at),start=Date.parse(row.start_time);
      if(!Number.isFinite(captured)||!Number.isFinite(start)||captured>=start-60000)continue;
      const payload=JSON.parse(row.payload),p=payload.probabilities;
      if(row.home_goals==null||row.away_goals==null)continue;
      const home=Number(row.home_goals),away=Number(row.away_goals);
      if(!scorable(p)||!Number.isInteger(home)||!Number.isInteger(away)||home<0||away<0)continue;
      const league=row.league,version=row.version,key=league+'|'+version;
      const group=groups.get(key)??{league,version,totals:emptyTotals()};
      addOutcome(group.totals,p,home,away);
      groups.set(key,group);

      // Older rows have no counterfactuals. All three stages must be from one
      // saved pregame analysis; never backfill a missing stage after kickoff.
      const a=payload.analysis,c=a?.contextForecast;
      if(!c||a.version!==version||a.capturedAt!==row.captured_at||!scorable(c.baseline)||!scorable(c.formOnly))continue;
      const coverage=c.injuryCoverage,injuryShiftApplied=c.injuryShiftApplied;
      if(!['both','partial','none'].includes(coverage)||typeof injuryShiftApplied!=='boolean'||(injuryShiftApplied&&coverage!=='both'))continue;
      const pairKey=[key,coverage,injuryShiftApplied].join('|');
      const pair=paired.get(pairKey)??{league,version,coverage,injuryShiftApplied,baseline:emptyTotals(),formOnly:emptyTotals(),published:emptyTotals()};
      addOutcome(pair.baseline,c.baseline,home,away);
      addOutcome(pair.formOnly,c.formOnly,home,away);
      addOutcome(pair.published,p,home,away);
      paired.set(pairKey,pair);
    }catch{/* Malformed snapshots cannot supply verification data. */}
  }
  return {
    groups:[...groups.values()].map(g=>({league:g.league,version:g.version,...averages(g.totals)})),
    comparisons:[...paired.values()].map(p=>({...p,baseline:averages(p.baseline),formOnly:averages(p.formOnly),published:averages(p.published)}))
  };
}
export function summarizeFootballForecasts(rows:any[]){
  return summarizeFootballVerification(rows).groups;
}
export async function footballLiveAudit(db:Database){
  const paired=await db.prepare(`SELECT f.league,f.game_id,f.version,f.start_time,f.captured_at,f.payload,r.home_goals,r.away_goals FROM football_forecasts f JOIN football_results r ON f.league=r.league AND f.game_id=r.game_id AND f.start_time=r.start_time ORDER BY f.start_time DESC LIMIT 5000`).all();
  const counts=await db.prepare("SELECT COUNT(*) AS snapshots,COUNT(DISTINCT league || '|' || game_id) AS games FROM football_forecasts").first();
  return {available:true,counts,selection:footballSelectionAudit(paired.results),...summarizeFootballVerification(paired.results),scope:'正式上線後保存的最後一筆賽前快照；只核對實際90分鐘完場，不是實際下注紀錄。',limit:5000};
}

// Latest default pre-match snapshot per fixture. Never let a superseded version
// or a personal weight profile enter the public settled sample.
export async function domesticFootballRecord(db:Database,league:FootballLeague){
 const {results}=await db.prepare(`SELECT f.league,f.game_id,f.payload,f.version,f.captured_at,f.start_time,r.home_goals,r.away_goals
  FROM football_results r JOIN football_forecasts f ON f.league=r.league AND f.game_id=r.game_id AND f.start_time=r.start_time
  WHERE r.league=? AND NOT EXISTS
   (SELECT 1 FROM football_forecasts n WHERE n.league=f.league AND n.game_id=f.game_id AND n.start_time=f.start_time
    AND (n.captured_at>f.captured_at OR (n.captured_at=f.captured_at AND n.version>f.version)))
  ORDER BY f.start_time DESC LIMIT 500`).bind(league).all();
 let all=0,hits=0,featured=0,featuredHits=0;
 const injury={paired:0,adjusted:0,corrected:0,spoiled:0,changed:0,missingRoster:0,missingRole:0,beforeHits:0,afterHits:0,partialTrial:{paired:0,corrected:0,spoiled:0}};
 for(const r of results){
  try{
   const a=JSON.parse(r.payload).analysis,p=a?.probabilities;
   if(!scorable(p)||a.domesticForecast?.policy!=='five-league-v1'||a.version!==r.version||a.capturedAt!==r.captured_at||
      !(Date.parse(r.captured_at)<Date.parse(r.start_time)-60000)||r.home_goals==null||r.away_goals==null)continue;
   const h=Number(r.home_goals),v=Number(r.away_goals);
   if(![h,v].every(x=>Number.isInteger(x)&&x>=0))continue;
   const ps=[p.home,p.draw,p.away],hit=Number(ps.indexOf(Math.max(...ps))===(h>v?0:h===v?1:2));
   all++;hits+=hit;
   // The afterShots stage already includes form and xG. Only the final injury tilt differs.
   const before=a.domesticForecast.afterShots,absence=a.matchEvidence?.absences;
   if(!absence||!Array.isArray(absence.home)||!Array.isArray(absence.away)){
     injury.missingRoster++;
   }else if(absence.method==='minutes'&&scorable(before)&&a.contextForecast?.injuryCoverage==='both'){
     const captured=Date.parse(a.capturedAt),checked=Date.parse(absence.checkedAt);
     if(checked<=captured&&captured-checked<=3600000){
       if([...absence.home,...absence.away].some(player=>!player.role)){
         injury.missingRole++;
         const trial=a.domesticForecast.partialRoleTrial;
         if(scorable(trial)){
           const values=[trial.home,trial.draw,trial.away],outcome=h>v?0:h===v?1:2;
           const trialHit=Number(values.indexOf(Math.max(...values))===outcome);
           injury.partialTrial.paired++;injury.partialTrial.corrected+=Number(trialHit>hit);injury.partialTrial.spoiled+=Number(trialHit<hit);
         }
       }
       else {
         const prior=[before.home,before.draw,before.away],oldPick=prior.indexOf(Math.max(...prior)),newPick=ps.indexOf(Math.max(...ps));
         const oldHit=Number(oldPick===(h>v?0:h===v?1:2));
         injury.paired++;injury.beforeHits+=oldHit;injury.afterHits+=hit;
         injury.adjusted+=Number(a.contextForecast.injuryShiftApplied===true);
         injury.changed+=Number(oldPick!==newPick);injury.corrected+=Number(hit>oldHit);injury.spoiled+=Number(hit<oldHit);
       }
     }
   }
   if(a.domesticForecast.featured===true){featured++;featuredHits+=hit;}
  }catch{/* Incomplete historical payloads cannot supply a verified pick. */}
 }
 return {all,hits,featured,featuredHits,injury,selection:footballSelectionAudit(results)};
}
