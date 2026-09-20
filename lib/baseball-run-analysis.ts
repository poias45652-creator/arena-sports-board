import {scoreGrid,settle,type Outcome,type Settlement} from './markets';
import {internationalTeam} from './international-teams';
import {INTERNATIONAL_MARKET_SOURCE,internationalMarketOptions,internationalMarketQuote,type InternationalPick} from './international-market-options';
import {BOARD_MARKETS} from './board-markets';
import type {PregameGame} from './international-pregame';
import type {MarketKey} from './pinnacle';
import type {HrDisplayMarket} from './hr9988';

export type ModelLeague='NPB'|'CPBL'|'KBO';
export const MODEL_VERSION={NPB:'npb-runs-poisson-v2-sp60',CPBL:'cpbl-game-logs-poisson-v3-sp60',KBO:'kbo-runs-poisson-v2-sp60'} as const;
export const RUN_MODEL_WEIGHTS=Object.freeze({starter:.6,offense:.2,defense:.1,bullpen:.1});
export const MODEL_NOTE='模型估算，尚未經歷史回測校準。';
export const isModelLeague=(league:string):league is ModelLeague=>league==='NPB'||league==='CPBL'||league==='KBO';
const MAX_SOURCE_AGE=36*3600000;
const sides=['away','home'] as const;
type Side=typeof sides[number];
type Fixture={start:string;away:string;home:string;live?:boolean;starters?:{away?:string;home?:string}};
export type RunModelInput={team:string;starter:string;scored:number;allowed:number;games:number;splitGames:number;offense:number;defense:number;starterEra:number;bullpenEra:number;starterInnings:number;recentStarts:number;starterObservedAt:string;teamObservedAt:string;bullpenObservedAt:string;bullpenMode:'reported'|'game_logs'|'team_defense'};
/** Fixed weights apply to the regulation run projection after sample-size shrinkage.
 * They are input coefficients, not percentage-point win bonuses or fitted importance.
 * Extra innings exclude the starter and normalize the remaining factors to 100%. */
export function inningRunRate(bat:RunModelInput,pit:RunModelInput,inning:number):number{
 const w=RUN_MODEL_WEIGHTS;
 const other=w.offense*bat.offense+w.defense*pit.defense+w.bullpen*pit.bullpenEra;
 return (inning<=9?w.starter*pit.starterEra+other:other/(w.offense+w.defense+w.bullpen))/9;
}
export type RunAnalysis={version:string;status:'ready'|'waiting_data'|'started';reason:string;fixture:Fixture;capturedAt:string;inputs:Partial<Record<Side,RunModelInput>>;notes:string[];expected:{away:number;home:number}|null;win:{away:number;home:number;draw:number}|null;grids:{full:Outcome[];firstHalf:Outcome[]}|null};
const number=(value:unknown,max=30):number|null=>{const s=String(value??'').trim();if(!/^\d+(?:\.\d+)?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)&&n>=0&&n<=max?n:null;};
const innings=(value:unknown)=>{const m=String(value??'').trim().match(/^(\d+)(?:\.([012]))?$/);return m?Number(m[1])+Number(m[2]||0)/3:null;};
const countGames=(s:string)=>{const m=s?.match(/^(\d+)-(\d+)-(\d+)(?:\s|$)/);return m?Number(m[1])+Number(m[2])+Number(m[3]):null;};
const rates=(s:string)=>{const m=s?.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);if(!m)return null;const a=number(m[1],15),b=number(m[2],15);return a!==null&&b!==null&&a>0&&b>0?[a,b]:null;};
const team=(s:string,league:ModelLeague)=>internationalTeam(s.replace(/\s*[（(](?:主|客)[）)]\s*/g,'').trim(),league);
const person=(s:string)=>s.replace(/[\s・·]/g,'');
export const analysisStartTime=(start:string)=>Date.parse(start.replaceAll('/','-').replace(' ','T')+'+08:00');
export const analysisFixtureKey=(g:Fixture,league:ModelLeague='NPB')=>JSON.stringify([league,analysisStartTime(g.start),team(g.away,league),team(g.home,league)]);
const validObserved=(at:string,start:number,now:number)=>{const time=Date.parse(at);return Number.isFinite(time)&&time<=now&&time<start&&now-time<=MAX_SOURCE_AGE;};

function modelInput(g:PregameGame,side:Side,now:number,notes:string[],league:ModelLeague):RunModelInput|string{
 const t=g[side],label=side==='away'?'客隊':'主隊',table=g.comparison,start=analysisStartTime(g.start);
 const logs=league==='CPBL'?t.gameLogs:undefined;
 if(logs&&!validObserved(logs.observedAt,start,now))return label+'逐場日誌過期或當時尚未取得';
 const rawStarterUsable=t.starter.quality==='source_reported'&&number(t.starter.season.era)!==null&&(innings(t.starter.season.innings)||0)>0&&['era','innings'].every(field=>validObserved(t.starter.statSources?.[field as 'era'|'innings']?.observedAt||t.retainedSource?.observedAt||g.source.observedAt,start,now));
 const derived=logs?.starter||(!rawStarterUsable?logs?.recentStarter:null);
 const logStarter=derived?.name===t.starter.name?derived:null;
 const teamObservedAt=g.comparisonSource?.observedAt||t.retainedSource?.observedAt||g.source.observedAt;
 const statTimes=logStarter?[logs!.observedAt]:['era','innings'].map(field=>t.starter.statSources?.[field as 'era'|'innings']?.observedAt||t.retainedSource?.observedAt||g.source.observedAt);
 const starterObservedAt=statTimes.slice().sort()[0];
 if(statTimes.some(at=>!validObserved(at,start,now)))return label+'先發統計欄位過期或擷取時間不符';
 if(!validObserved(teamObservedAt,start,now)||!validObserved(starterObservedAt,start,now))return label+'統計過期或擷取時間不符';
 if(t.starter.source&&!validObserved(t.starter.source.observedAt,start,now))return label+'先發公告時間不符';
 if(t.starter.review&&Date.parse(t.starter.review.reviewedAt)>now)return label+'當時尚未完成資料核對';
 if(!t.starter.name||!logStarter&&t.starter.quality!=='source_reported')return label+'先發成績缺漏或待核對';
 const era=logStarter?number(logStarter.era):number(t.starter.season.era),ip=logStarter?logStarter.outs/3:innings(t.starter.season.innings);
 const bullpen=logs?.bullpen?number(logs.bullpen.era):number(t.bullpen?.era),bpIp=logs?.bullpen?logs.bullpen.outs/3:innings(t.bullpen?.innings);
 if(era===null||ip===null||ip<=0)return label+'先發 ERA／投球局數不足';
 const bullpenObservedAt=logs?.bullpen?logs.observedAt:t.retainedSource?.observedAt||g.source.observedAt;
 const hasBullpen=bullpen!==null&&bpIp!==null&&bpIp>0&&validObserved(bullpenObservedAt,start,now);
 if(!hasBullpen&&league!=='CPBL')return label+'牛棚 ERA／投球局數不足';
 const rows=table?.rows.filter(r=>r[table.headers.indexOf('類別')]==='本季'&&team(r[table.headers.indexOf('球隊')]||'',league)===team(t.team,league))||[];
 if(!table||rows.length!==1)return label+'本季得失分尚未取得';
 const r=rows[0],read=(label:string)=>r[table.headers.indexOf(label)]||'';
 const season=rates(read('得/失分')),games=countGames(read('勝敗'));
 if(!season||games===null||games<20)return label+'本季得失分樣本不足 20 場';
 const split=rates(read(side==='home'?'主場得/失分':'客場得/失分'));
 const splitCount=countGames(read(side==='home'?'主場勝率':'客場勝率'));
 const splitGames=split&&splitCount!==null&&splitCount>=10&&splitCount<=games?splitCount:0;
 const offense=splitGames?(split![0]*splitGames+season[0]*20)/(splitGames+20):season[0];
 const defense=splitGames?(split![1]*splitGames+season[1]*20)/(splitGames+20):season[1];
 const recent=t.starter.recent,di=recent.headers.indexOf('日期'),ii=recent.headers.indexOf('投球局');
 const seen=new Set<string>();
 const prior=logStarter?logStarter.starts.filter(r=>r.date<g.date&&start-Date.parse(r.date+'T00:00:00+08:00')<=60*86400000).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(r=>r.outs/3):recent.rows.filter(row=>{
  const date=row[di],time=Date.parse(date+'T00:00:00+08:00');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||date>=g.date||!Number.isFinite(time)||start-time>60*86400000||seen.has(date))return false;
  seen.add(date);return true;
 }).sort((a,b)=>b[di].localeCompare(a[di])).slice(0,5).map(r=>innings(r[ii])).filter((n):n is number=>n!==null&&n>0&&n<=9);
 const starterInnings=prior.length>=3?Math.max(3,Math.min(7,prior.reduce((a,b)=>a+b,0)/prior.length)):5;
 if(prior.length<3)notes.push(label+'先發近 60 日不足 3 場，參考局數暫設 5 局；不影響固定先發權重');
 if(logStarter)notes.push(label+`先發 ERA／WHIP 由${logs!.starter?'本季':`球隊最近 ${logs!.recentWindow} 場期間的`} ${logStarter.games} 次登板重算；參考局數只取先發登板。`);
 if(logs?.bullpen)notes.push(label+`牛棚由${logs.bullpenScope==='season'?'本季':`最近 ${logs.recentWindow} 場`}後援紀錄重算，共 ${logs.bullpen.games} 場；先合計出局數與責失再計算 ERA。`);
 if(logs)notes.push(...logs.notes.map(n=>label+n));
 if(!hasBullpen)notes.push(label+'缺完整牛棚局數，牛棚項使用已觀測的團隊失分均值；不是牛棚實測成績');
 if(t.battingWarnings?.length)notes.push(label+'團隊打擊表有待核對欄位，未納入計算；得失分採本季戰績表');
 return {team:t.team,starter:t.starter.name,scored:season[0],allowed:season[1],games,splitGames,offense,defense,
  starterEra:(era*ip+season[1]*20)/(ip+20),bullpenEra:hasBullpen?(bullpen!*bpIp!+season[1]*60)/(bpIp!+60):defense,starterInnings,recentStarts:prior.length,starterObservedAt,teamObservedAt,bullpenObservedAt,bullpenMode:hasBullpen?(logs?.bullpen?'game_logs':'reported'):'team_defense'};
}

/** Independent Poisson innings. Extra frames continue only on ties, to the supplied cap.
 * Home walk-offs are approximated as a one-run lead; walk-off HR overshoot is not modeled.
 * Ties remaining at the cap are retained, never split 50/50. */
export function scoreDistribution(away:number[],home:number[],automaticRunnerScoreProbability=0):Outcome[]{
 const cap=away.length;
 if(!Number.isFinite(automaticRunnerScoreProbability)||automaticRunnerScoreProbability<0||automaticRunnerScoreProbability>1||![9,11,12].includes(cap)||home.length!==cap||[...away,...home].some(n=>!Number.isFinite(n)||n<=0||n>3))return [];
 const out=new Map<string,Outcome>();
 const add=(a:number,h:number,p:number)=>{const k=a+':'+h,old=out.get(k);if(old)old.p+=p;else out.set(k,{away:a,home:h,p});};
 let ties=new Map<number,number>();
 // Inning 9 is handled separately to avoid playing its bottom when the home team already leads.
 const eight=scoreGrid(away.slice(0,8).reduce((a,b)=>a+b,0),home.slice(0,8).reduce((a,b)=>a+b,0),false).filter(o=>o.p>1e-16);
 const ninth=scoreGrid(away[8],home[8],false).filter(o=>o.p>1e-16);
 for(const o of eight)for(const n of ninth){
  const p=o.p*n.p;if(p<1e-18)continue;
  const a=o.away+n.away,h=o.home;
  if(h>a){add(a,h,p);continue;}
  const end=Math.min(h+n.home,a+1);
  if(end===a)ties.set(a,(ties.get(a)||0)+p);else add(a,end,p);
 }
 if(cap===9)for(const [runs,mass] of ties)add(runs,runs,mass);
 for(let inning=9;inning<cap;inning++){
  const next=new Map<number,number>(),base=scoreGrid(away[inning],home[inning],false),q=automaticRunnerScoreProbability;
  // One runner on second, approximated as a Bernoulli extra run for each side.
  // q is an explicit unfitted model assumption, never a scraped statistic.
  const frame=q?base.flatMap(o=>[0,1].flatMap(a=>[0,1].map(h=>({away:o.away+a,home:o.home+h,p:o.p*(a?q:1-q)*(h?q:1-q)})))).filter(o=>o.p>1e-16):base.filter(o=>o.p>1e-16);
  for(const [runs,mass] of ties)for(const o of frame){const p=mass*o.p;if(p<1e-18)continue;
   const a=runs+o.away,h=runs+Math.min(o.home,o.away+1);
   if(a===h&&inning<cap-1)next.set(a,(next.get(a)||0)+p);else add(a,h,p);
  }ties=next;
 }
 const result=[...out.values()],mass=result.reduce((n,o)=>n+o.p,0);
 return mass>0?result.map(o=>({...o,p:o.p/mass})):[];
}

export function buildRunAnalysis(g:PregameGame,now=Date.now(),league:ModelLeague='NPB'):RunAnalysis{
 const fixture={start:g.start,away:g.away.team,home:g.home.team,starters:{away:g.away.starter.name,home:g.home.starter.name}};
 const report:RunAnalysis={version:MODEL_VERSION[league],status:'waiting_data',reason:'',fixture,capturedAt:new Date(now).toISOString(),inputs:{},notes:[MODEL_NOTE,...(league==='CPBL'?['10 局起突破僵局的二壘跑者，額外得分機率暫設 60%；為未校準假設，非來源統計。']:[])],expected:null,win:null,grids:null};
 const stop=(reason:string,status:RunAnalysis['status']='waiting_data')=>({...report,status,reason});
 const start=analysisStartTime(g.start);
 if(!isModelLeague(league)||g.league!==league||g.kind!=='pregame_snapshot'||!Number.isFinite(start)||!g.start.startsWith(g.date+' ')||team(g.away.team,league)===team(g.home.team,league))return stop('賽前資料場次不符');
 if(now>=start)return stop('已開賽，停止賽前估算','started');
 if(!validObserved(g.source.observedAt,start,now))return stop('賽前資料擷取時間不符或已過期');
 if(league==='KBO'){
  if(g.rules?.league!=='KBO'||g.rules.season!==2026||Number(g.date.slice(0,4))!==2026||g.rules.phase!=='regular'||g.rules.maxInnings!==11||!validObserved(g.rules.fixtureObservedAt,start,now))return stop('韓職例行賽場次／延長局數尚未核對');
  report.notes.push('一般例行賽最多 11 局，11 局後保留和局；未套用中職突破僵局跑者。雙重賽與季後賽暫不估算。','團隊得失分由本場日期之前的已完賽紀錄彙算，沒有把當日比分納入。');
 }
 for(const side of sides){const input=modelInput(g,side,now,report.notes,league);if(typeof input==='string')return stop(input);report.inputs[side]=input;}
 const a=report.inputs.away!,h=report.inputs.home!;
 const cap=league==='KBO'?11:12;
 const away=Array.from({length:cap},(_,i)=>inningRunRate(a,h,i+1)),home=Array.from({length:cap},(_,i)=>inningRunRate(h,a,i+1));
 const expected={away:away.slice(0,9).reduce((a,b)=>a+b,0),home:home.slice(0,9).reduce((a,b)=>a+b,0)};
 if(Object.values(expected).some(n=>n<=0||n>15))return stop('預期得分超出可計算範圍');
 const full=scoreDistribution(away,home,league==='CPBL'?.6:0),firstHalf=scoreGrid(away.slice(0,5).reduce((a,b)=>a+b,0),home.slice(0,5).reduce((a,b)=>a+b,0),false);
 if(!full.length||!firstHalf.length)return stop('比分分布無法計算');
 const win=full.reduce((r,o)=>{r[o.away>o.home?'away':o.home>o.away?'home':'draw']+=o.p;return r;},{away:0,home:0,draw:0});
 return {...report,status:'ready',expected,win,grids:{full,firstHalf},notes:[...new Set(report.notes)]};
}

export function matchingRunAnalysis(game:Fixture,reports:Map<string,RunAnalysis>,now:number,league:ModelLeague='NPB'):RunAnalysis|null{
 const r=reports.get(analysisFixtureKey(game,league));if(!r||r.version!==MODEL_VERSION[league])return null;
 if(game.live||now>=analysisStartTime(game.start))return {...r,status:'started',reason:'已開賽，停止賽前估算',win:null,expected:null,grids:null};
 if(sides.some(side=>game.starters?.[side]&&person(game.starters[side]!)!==person(r.fixture.starters?.[side]||'')))return {...r,status:'waiting_data',reason:'先發已變更，等待新投手成績',win:null,expected:null,grids:null};
 if(Object.values(r.inputs).some(s=>!validObserved(s.teamObservedAt,analysisStartTime(game.start),now)||!validObserved(s.starterObservedAt,analysisStartTime(game.start),now)||(s.bullpenMode!=='team_defense'&&!validObserved(s.bullpenObservedAt,analysisStartTime(game.start),now))))return {...r,status:'waiting_data',reason:'分析資料已過期，等待來源更新',win:null,expected:null,grids:null};
 return r;
}

export function marketOutcomes(game:{id:number|string;home:string;away:string;displayMarkets?:HrDisplayMarket[]},key:MarketKey,report:RunAnalysis|null,quotesFresh:boolean,league:ModelLeague='NPB'):{pick:InternationalPick;result:Settlement;expectedProfit:number}[]{
 if(!quotesFresh||report?.version!==MODEL_VERSION[league]||report?.status!=='ready'||!report.grids)return [];
 const source=INTERNATIONAL_MARKET_SOURCE[key],q=internationalMarketQuote(game,source.period,source.type);
 if(!q)return [];
 const grid=source.period==='firstHalf'?report.grids.firstHalf:report.grids.full;
 return internationalMarketOptions(game,league,source.period,source.type).flatMap(pick=>{
  let result:Settlement|null;
  if(key==='firstHalfOddEven'){
   const odd=grid.reduce((n,o)=>n+((o.away+o.home)%2?o.p:0),0),win=pick.side==='home'?odd:1-odd;
   result={win,loss:1-win,push:0,partialWin:0,partialLoss:0,winWeight:win,lossWeight:1-win};
  }else{
   const total=source.type==='104';
   result=settle(grid,{gameId:0,market:total?'total':'spread',side:total?(pick.side==='home'?'over':'under'):pick.side,line:q.line,boundary:q.boundary,parts:q.parts});
  }
  return result?[{pick,result,expectedProfit:result.winWeight*pick.price-result.lossWeight}]:[];
 });
}

export function suggestedPicks(games:any[],reports:Map<string,RunAnalysis>,now:number,fresh:boolean,winnerOnly=false,league:ModelLeague='NPB'):InternationalPick[]{
 if(!fresh)return [];
 return games.flatMap(game=>{
  const report=matchingRunAnalysis(game,reports,now,league);
  const choices=BOARD_MARKETS.filter(({key})=>!winnerOnly||key==='moneyline').flatMap(({key})=>marketOutcomes(game,key,report,true,league)).filter(c=>c.expectedProfit>0).sort((a,b)=>b.expectedProfit-a.expectedProfit);
  return choices[0]?[choices[0]]:[];
 }).sort((a,b)=>b.expectedProfit-a.expectedProfit).map(c=>c.pick);
}
