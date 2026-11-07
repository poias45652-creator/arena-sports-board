import fit from '../data/football/shot-selection-v1.json';
import {footballDistribution, type FootballAnalysis, type FootballGame} from './football';
import {isShotLeague, parseShotCalendar, shotHistory, utcMatchDay, type ShotCalendar} from './football-shot-calendar';
import {shotFeatures, shotRates} from './football-shot-model';

export const selectionVersion = 'football-selection-20261107-v1';
const threshold = .70;
const labels = {home:'主勝',draw:'和局',away:'客勝'};
type Outcome = keyof typeof labels;
export type FootballSelection = {version:string; source:'xg'|'shots'; pick:Outcome|null; probability:number;
  homeGames:number; awayGames:number; sourceFetchedAt:string};
const parsedCalendars = new WeakMap<object,ShotCalendar>();
type Source = (path:string,ttl:number,timeout:number) => Promise<{value:unknown;fetchedAt:string}>;

function leader(p:{home:number;draw:number;away:number}) {
  const choices = (Object.keys(labels) as Outcome[]).sort((a,b) => p[b] - p[a]);
  return {pick:p[choices[0]] >= threshold && p[choices[0]] > p[choices[1]] ? choices[0] : null, probability:p[choices[0]]};
}
export function domesticXgReady(a:FootballAnalysis) {
  const e = a.external;
  return e?.modelApplied === true && e.modelFamily !== 'score-market' && !!a.homeForm && !!a.awayForm &&
    e.homeXgGames >= Math.max(5,.8*a.homeForm.games) && e.awayXgGames >= Math.max(5,.8*a.awayForm.games);
}

export function applyShotSelection(game:FootballGame, base:FootballAnalysis, calendars:ShotCalendar[], fetchedAt:string, now:number):FootballAnalysis {
  if (!isShotLeague(game.league) || game.neutral || game.state !== 'scheduled' || !game.timeConfirmed || Date.parse(game.start)<=now ||
    base.status !== 'ready' || !base.probabilities || !Number.isFinite(Date.parse(fetchedAt)) || Date.parse(fetchedAt)>now) return base;
  if (domesticXgReady(base)) {
    return {...base,selection:{version:selectionVersion,source:'xg',...leader(base.probabilities),
      homeGames:base.external!.homeXgGames,awayGames:base.external!.awayXgGames,sourceFetchedAt:base.external!.fetchedAt}};
  }
  const history = shotHistory(game,calendars,now);
  if (!history) return base;
  const features = shotFeatures(history,utcMatchDay(Date.parse(game.start)),game.home.id,game.away.id);
  if (!features) return base;
  const rates = shotRates(features.rows,fit);
  if (!rates) return base;
  const distribution = footballDistribution(rates[0],rates[1]);
  const choice = leader(distribution.probabilities);
  const selection:FootballSelection = {version:selectionVersion,source:'shots',...choice,
    homeGames:features.homeGames,awayGames:features.awayGames,sourceFetchedAt:fetchedAt};
  if (!choice.pick) return {...base,selection};
  const version = 'football-shot-poisson-v1';
  return {...base,...distribution,selection,version,expected:{home:rates[0],away:rates[1]},
    capturedAt:new Date(now).toISOString(),external:undefined,historyMode:'competition',
    lean:'模型傾向'+labels[choice.pick],
    calibration:{status:'baseline',label:'射正與對手強度',version,reasons:[],holdoutGames:0,recentGames:0,
      uncertainty:'七成門檻用於篩選，實際命中另按賽前快照結算。'},
    notes:[`以 ESPN 同聯賽正式賽果、主客進球、賽前 Elo 與近期射正計算。主隊有 ${features.homeGames} 場、客隊有 ${features.awayGames} 場射正紀錄。`,
      '勝和負、大小球與比分取自同一個90分鐘比分分布。此分支未使用實測 xG、傷停名單或賠率。']};
}

export async function selectDomesticForecast(game:FootballGame, base:FootballAnalysis, read:Source):Promise<FootballAnalysis> {
  const now=Date.now();
  if (!isShotLeague(game.league) || game.neutral || base.status!=='ready' || !base.probabilities ||
      game.state!=='scheduled' || !game.timeConfirmed || Date.parse(game.start)<=now || !/^\d+$/.test(game.id)) return base;
  if (domesticXgReady(base)) return applyShotSelection(game,base,[],base.external!.fetchedAt,now);
  const year=new Date(game.start).getUTCFullYear();
  try {
    const feeds=await Promise.all([year-1,year].map(async y => {
      const feed=await read(`${game.league}/scoreboard?dates=${y}&limit=1000`,y<new Date(now).getUTCFullYear()?86400000:1800000,6000);
      if (!feed.value || typeof feed.value !== 'object') throw Error('年度來源格式無效');
      let calendar=parsedCalendars.get(feed.value);
      if (!calendar || calendar.league!==game.league || calendar.year!==y) {
        calendar=parseShotCalendar(feed.value,game.league,y);
        parsedCalendars.set(feed.value,calendar);
      }
      return {calendar,at:feed.fetchedAt};
    }));
    return applyShotSelection(game,base,feeds.map(f=>f.calendar),feeds.map(f=>f.at).sort().at(-1)!,Date.now());
  } catch { return base; }
}
