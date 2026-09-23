import {fetchPlaysportPregame} from './playsport-pregame';
import dailyCaptures from '@/data/playsport-capture-20260921.json';
import {getRawDb} from '@/db';
import {collectLeague,dayInTaipei} from '@/server/baseball-current.mjs';
import {createLiveFeed} from '@/server/baseball-live-feed.mjs';
import {readLiveSnapshot,writeLiveSnapshot} from '@/server/baseball-sites-store.mjs';
import {collectSeasonPitching} from '@/server/baseball-season-pitching.mjs';
import {supplementSeasonPitching} from './international-season-pitching';
import {internationalTeam} from './international-teams';
import {pregameImportsByLeague} from './pregame-imports';
import {currentPregame,pregameMissing} from './international-current-pregame';
import type {PregameData} from './international-pregame';
import cpblNews from '@/data/cpbl-starter-news-20260920.json';
import cpblSeason from '@/data/cpbl-pitcher-supplement-20260919.json';
import {applyCpblPitcherReview} from './cpbl-reviewed-pitcher';
import {supplementCpblPitchers} from './cpbl-pitcher-supplement';
import {supplementKboTeamRuns} from './kbo-team-runs';
import {getKboRunHistory} from './kbo-run-history';
import {applyKboPitcherReview} from './kbo-reviewed-pitcher';
import {getCpblGameLogs} from './cpbl-game-logs-store';
import {supplementCpblGameLogs,cpblLogCoverage} from './cpbl-game-logs';
import {saveInternationalForecasts} from './international-model-audit-store';
import {buildRunAnalysis,type ModelLeague} from './baseball-run-analysis';

export const getInternationalLive=createLiveFeed({day:dayInTaipei,
 collect:async(league:string,options:any)=>{
  const result=await collectLeague(league,options);
  if(league==='CPBL'&&result.date===cpblNews.date)for(const g of result.games){
   const n=cpblNews.games.find(n=>n.away===g.away.name&&n.home===g.home.name&&Date.parse(n.start.replace(' ','T')+'+08:00')===Date.parse(g.startTime));
   if(n)for(const side of ['away','home'] as const)if(!g.starters[side])g.starters[side]={id:null,name:n[side==='away'?'awayStarter':'homeStarter'],confirmation:'dated_news_probable',source:{provider:cpblNews.source.name,url:cpblNews.source.url,fetchedAt:cpblNews.source.observedAt}};
  }
  return result;
 },
 read:(league:string,date:string)=>readLiveSnapshot(getRawDb(),league,date),
 write:(snapshot:any)=>writeLiveSnapshot(getRawDb(),snapshot)
});

const pending=new Map<string,Promise<any>>(),cache=new Map<string,{until:number;data:any}>();
export async function getInternationalPregame(league:string,date=dayInTaipei()){
 if(!['CPBL','NPB','KBO'].includes(league)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid league/date');
 const key=league+':'+date,old=cache.get(key);if(old&&old.until>Date.now())return old.data;if(pending.has(key))return pending.get(key);
 const task=(async()=>{
  const archives:PregameData[]=[];const baseline=pregameImportsByLeague[league];if(baseline?.date===date)archives.push(baseline);for(const saved of dailyCaptures)if(saved.league===league&&saved.date===date)archives.push(saved as PregameData);
  let storageError:string|null=null;
  try{const stored=await getRawDb().prepare('SELECT payload FROM baseball_pregame WHERE league=? AND date=? LIMIT 1').bind(league,date).first<{payload:string}>();if(stored)archives.push(JSON.parse(stored.payload));}catch{storageError='賽前資料儲存服務暫時無法讀取';}
  const liveTask=getInternationalLive(league,date);
  const publicTask=liveTask.then((feed:any)=>collectSeasonPitching(league,date,feed.games.filter((g:any)=>g.status==='pregame'&&!g.sourceStale).flatMap((g:any)=>[internationalTeam(g.away.name,league),internationalTeam(g.home.name,league)])));
  const [feed,playsport,kboHistory,cpblLogs,publicPitching]=await Promise.all([liveTask,fetchPlaysportPregame(league,date),league==='KBO'?getKboRunHistory():null,league==='CPBL'?getCpblGameLogs(Number(date.slice(0,4))):null,publicTask]);
  if(playsport.snapshot.games.length)archives.push(playsport.snapshot);
  let pregame=supplementCpblPitchers(applyCpblPitcherReview(currentPregame(league,date,feed,archives)),cpblSeason);
  pregame=applyKboPitcherReview(pregame);
  pregame=supplementSeasonPitching(pregame,publicPitching);
  if(kboHistory)pregame=supplementKboTeamRuns(pregame,kboHistory);
  if(cpblLogs)pregame=supplementCpblGameLogs(pregame,cpblLogs.snapshot);
  if(pregame.games.length)try{
   await getRawDb().prepare(`INSERT INTO baseball_pregame (key,league,date,observed_at,payload) VALUES (?,?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET observed_at=excluded.observed_at,payload=excluded.payload WHERE excluded.observed_at>=baseball_pregame.observed_at`)
    .bind(key,league,date,pregame.observedAt,JSON.stringify(pregame)).run();
  }catch{storageError='本次賽前資料未能保存，重新載入時可能顯示較舊資料';}
  const forecastStorage=await saveInternationalForecasts(pregame),coverage=pregameMissing(pregame);
  const reports=pregame.games.map(g=>buildRunAnalysis(g,Date.now(),league as ModelLeague));
  const analysisCoverage={ready:reports.filter(r=>r.status==='ready').length,total:reports.length,blocked:reports.filter(r=>r.status!=='ready').map(r=>({start:r.fixture.start,away:r.fixture.away,home:r.fixture.home,status:r.status,reason:r.reason}))};
  const partial=feed.status==='partial'||playsport.errors.length>0||publicPitching.errors.length>0||coverage.era<coverage.teams||coverage.whip<coverage.teams||coverage.starters<coverage.teams||analysisCoverage.ready<analysisCoverage.total;
  const status=feed.stale?'stale':partial?'partial':'ready';
  const data={kind:league.toLowerCase()+'-pregame',status:pregame.games.length?status:'unavailable',pregame,fetchedAt:pregame.observedAt||null,checkedAt:feed.checkedAt,pollAfterMs:300000,automaticBackgroundSync:false,
   scope:'開啟網站時每 5 分鐘檢查公開來源；保存最後成功資料。歷史補充欄位保留原時間。',error:feed.error||null,storageError,forecastStorage,
   playsport:{games:playsport.snapshot.games.length,errors:playsport.errors},
   statsFallback:{rows:publicPitching.rows.length,sources:publicPitching.sources,errors:publicPitching.errors,scope:publicPitching.scope},
   excludedFixtures:feed.games.filter((g:any)=>!g.sourceStale&&['cancelled','postponed','suspended','live','final'].includes(g.status)).map((g:any)=>({start:g.startTime,home:g.home.name,away:g.away.name,status:g.status})),
   coverage,analysisCoverage,live:{games:feed.games.length,status:feed.status,starters:feed.games.reduce((n:number,g:any)=>n+Number(!!g.starters?.away?.name)+Number(!!g.starters?.home?.name),0),lineups:feed.games.reduce((n:number,g:any)=>n+Number(g.lineups?.away?.length===9)+Number(g.lineups?.home?.length===9),0),pollAfterMs:feed.pollAfterMs},
   ...(cpblLogs?{gameLogs:{...cpblLogCoverage(cpblLogs.snapshot,date),error:cpblLogs.error}}:{}),
   missing:['完整傷停與臨時更換先發通知',...(league==='CPBL'?['中職已用非官網逐場日誌重算團隊與可核對投手成績；仍缺完整投球數、未取得先發及未通過核對的逐場明細']:['牛棚最近數日用量']),'團隊基準已完成首輪回測與校準研究；完整先發／牛棚模型尚未通過驗證，已接入真實賽前留存',...(league==='KBO'?['双重賽與季後賽規則尚未接入，暫停這些場次的估算']:[])]};
  console.info('international-pregame-summary',JSON.stringify({league,date,status:data.status,coverage,analysisCoverage,fallbackRows:publicPitching.rows.length,sourceErrors:[...playsport.errors,...publicPitching.errors],missingStart:feed.games.filter((g:any)=>!g.startTime).length,unknownStatus:feed.games.filter((g:any)=>g.status==='unknown').length}));
  if(cache.size>12)cache.clear();cache.set(key,{until:Date.now()+(feed.stale?60000:300000),data});return data;
 })().finally(()=>pending.delete(key));pending.set(key,task);return task;
}
