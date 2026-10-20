import {footballDay,type FootballGame} from '@/lib/football';
import {footballForecastSettingsKey,type FootballModelSettings} from '@/lib/football-model-weights';
import {footballFixtureKey,readyFootballAnalysis,type FootballReport} from '@/lib/football-recommendations';

const KEY='yj:football:pregame-reports:v1',LIMIT=80;
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'>;
type Entry={settings:string;report:FootballReport};
function entries(storage:Storage,now:number):Entry[]{
  try{
    const data=JSON.parse(storage.getItem(KEY)||'[]'),today=footballDay(new Date(now));
    return Array.isArray(data)?data.filter(e=>e&&typeof e.settings==='string'&&e.report?.game&&e.report?.analysis&&Number.isFinite(Date.parse(e.report.game.start))&&footballDay(e.report.game.start)>=today).slice(0,LIMIT):[];
  }catch{return [];}
}
// Only retain reports the member actually received before kickoff. This is a
// reload fallback, never an input to the server or the public accuracy ledger.
export function cacheFootballReport(storage:Storage,game:FootballGame,report:FootballReport,settings:FootballModelSettings,now=Date.now()){
  if(!readyFootballAnalysis(game,report,now))return;
  const key=footballFixtureKey(game),signature=footballForecastSettingsKey(settings);
  const previous=entries(storage,now),existing=previous.find(e=>e.settings===signature&&footballFixtureKey(e.report.game)===key);
  if(existing&&Date.parse(existing.report.analysis!.capturedAt)>Date.parse(report.analysis!.capturedAt))return;
  const next=[{settings:signature,report},...previous.filter(e=>e.settings!==signature||footballFixtureKey(e.report.game)!==key)].slice(0,LIMIT);
  try{storage.setItem(KEY,JSON.stringify(next));}catch{/* Server snapshots remain available if browser storage is full or disabled. */}
}
export function cachedFootballReport(storage:Storage,game:FootballGame,settings:FootballModelSettings,now=Date.now()):FootballReport|undefined{
  const signature=footballForecastSettingsKey(settings);
  return entries(storage,now).find(e=>e.settings===signature&&readyFootballAnalysis(game,e.report,now))?.report;
}
