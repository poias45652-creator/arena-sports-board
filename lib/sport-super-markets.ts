import {parseSourceLine,netProfit,type ParsedLine} from './settlement';
import {FOOTBALL_LEAGUES} from './football';
import {sportTeamKey,registeredNames,type MarketSport} from './sport-team-names';
export {sportTeamKey} from './sport-team-names';
export type SportFixture={id:string;league?:string;start:string;timeConfirmed:boolean;state:string;home:{id?:string;name:string;logo?:string};away:{id?:string;name:string;logo?:string}};
export type SportQuote={kind:'spread'|'total'|'moneyline';line:number;boundary:number;parts?:number[];display:string;home:number;away:number;draw?:number;signature:string};
export type SportEvent={id:number;home:string;away:string;spread:SportQuote|null;total:SportQuote|null;moneyline:SportQuote|null};
export type SportOutcomes={win:number;partialWin:number;push:number;partialLoss:number;loss:number;ev:number};
export type SportGrid={value:number;p:number}[];
// Match MLB's preferred direction: probability of any profit, including a partial win.
// Odds still determine settlement/EV, but do not hide the model's favored direction.
export function preferredSportOutcome(rows:(SportOutcomes|null)[]):number|null{
 if(rows.length!==2||rows.some(r=>!r||![r.win,r.partialWin,r.push,r.partialLoss,r.loss].every(p=>Number.isFinite(p)&&p>=0&&p<=1)))return null;
 const candidates=rows.map((r,index)=>({index,win:r!.win+r!.partialWin,loss:r!.loss+r!.partialLoss}))
  .filter(r=>r.win>r.loss+.000001).sort((a,b)=>b.win-a.win);
 return candidates[0]?.index??null;
}
export function sportQuoteLabel(quote:SportQuote,side:'home'|'away'|'over'|'under'){
 const raw=quote.display.replace(/^(主讓|客讓)\s*/,''),homeGives=quote.display.startsWith('主讓');
 const giving=side==='home'?homeGives:!homeGives;
 const flip=quote.kind==='spread'?!giving:side==='under';
 const line=raw.replace(/^(\d+)([+-])(\d{1,3})$/,(_,n,sign,p)=>`${n}${flip?(sign==='+'?'-':'+'):sign}${p}`);
 if(quote.kind==='total')return line;
 const venue=side==='home'?'主':'客';
 if(quote.line===0&&quote.boundary===0)return venue+'平手 0';
 return `${venue}${giving?'讓':'受讓'} ${giving?'-':'+'}${line}`;
}
const marketTypes=(sport:MarketSport)=>sport==='FOOTBALL'?{spread:101,total:102,moneyline:110}:{spread:103,total:104,moneyline:111};
function sourceTime(value:unknown){
 if(typeof value!=='string'||!/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(value))return NaN;
 const local=value.replaceAll('/','-').replace(' ','T'),time=Date.parse(local+'+08:00');
 return Number.isFinite(time)&&new Date(time+8*3600000).toISOString().slice(0,19)===local?time:NaN;
}
export function matchSportEvent(snapshot:any,game:SportFixture,sport:MarketSport,now=Date.now()):SportEvent|null{
 const captured=Date.parse(snapshot?.fetchedAt||''),start=Date.parse(game.start);
 if(!Number.isFinite(captured)||now-captured< -60000||now-captured>=150000||game.state!=='scheduled'||!game.timeConfirmed||!Number.isFinite(start)||start<=now||!Array.isArray(snapshot?.sportGames))return null;
 const matches=snapshot.sportGames.filter((r:any)=>{
  if(!r||r.league!==sport||r.live!==false||sport==='FOOTBALL'&&r.competition!==game.league||typeof r.home!=='string'||typeof r.away!=='string')return false;
  const sourceStart=sourceTime(r.start);
  return Number.isFinite(sourceStart)&&Math.abs(sourceStart-start)<=600000&&sportTeamKey(r.home,sport)===sportTeamKey(game.home.name,sport)&&sportTeamKey(r.away,sport)===sportTeamKey(game.away.name,sport);
 });
 if(matches.length!==1)return null;
 const r=matches[0],types=marketTypes(sport);
 const read=(kind:SportQuote['kind']):SportQuote|null=>{
  if(!Array.isArray(r.displayMarkets))return null;
  const markets=r.displayMarkets.filter((m:any)=>m?.period==='full'&&m.type===types[kind]);
  if(markets.length!==1||!Array.isArray(markets[0].quotes))return null;
  const primary=markets[0].quotes.filter((q:any)=>q?.primary===true);
  if(primary.length!==1||primary[0].open!==true)return null;
  const q=primary[0],h=Number(kind==='total'?q.over:q.homePrice),a=Number(kind==='total'?q.under:q.awayPrice),d=Number(q.drawPrice);
  if(![h,a].every(n=>Number.isFinite(n)&&n>0)||kind==='moneyline'&&sport==='FOOTBALL'&&(!Number.isFinite(d)||d<=0))return null;
  let parsed:ParsedLine|null={line:0,boundary:0,raw:''};
  if(kind==='spread'){
   if(Boolean(q.homeLine)===Boolean(q.awayLine))return null;
   parsed=parseSourceLine(q.homeLine||q.awayLine);
  }else if(kind==='total')parsed=parseSourceLine(q.total);
  if(!parsed)return null;
  const direction=kind==='spread'&&q.homeLine?-1:1;
  return {kind,line:parsed.line*direction,boundary:parsed.boundary*(kind==='spread'&&!q.homeLine?-1:1),parts:parsed.parts?.map(n=>n*direction),display:kind==='moneyline'?'獨贏':kind==='total'?parsed.raw:(q.homeLine?'主讓 ':'客讓 ')+parsed.raw,home:h,away:a,...(kind==='moneyline'&&sport==='FOOTBALL'?{draw:d}:{}),signature:JSON.stringify([snapshot.source,r.id,kind,q])};
 };
 return {id:r.id,home:r.home,away:r.away,spread:read('spread'),total:read('total'),moneyline:read('moneyline')};
}
const statusText={ready:'',missing:'來源尚未提供此全場玩法',closed:'來源已暫停此全場玩法',invalid:'來源全場資料不完整，暫停使用',ambiguous:'來源全場資料重複，暫停使用'};
type QuoteState=keyof typeof statusText;
export type SportMarketStatus={event:SportEvent|null;code:string;message:string;availableCount:number;markets:Record<SportQuote['kind'],{code:QuoteState;message:string}>};
// Diagnostics explain a rejection. Only the original guarded matcher can return
// an event; time/orientation/competition hints below never authorize a fallback.
export function sportMarketStatus(snapshot:any,game:SportFixture,sport:MarketSport,now=Date.now()):SportMarketStatus{
 const out:SportMarketStatus={event:null,code:'fixture_unmatched',message:'目前玩法來源尚未提供本場可確認的對應資料，取得後會自動更新。',availableCount:0,markets:{spread:{code:'missing',message:statusText.missing},total:{code:'missing',message:statusText.missing},moneyline:{code:'missing',message:statusText.missing}}};
 const reject=(code:string,message:string)=>({...out,code,message});
 if(!snapshot)return reject('source_pending','正在取得全場資料…');
 const captured=Date.parse(snapshot.fetchedAt||''),start=Date.parse(game.start);
 if(!Number.isFinite(captured)||now-captured< -60000)return reject('source_time_invalid','來源更新時間無效，等待重新取得');
 if(now-captured>=150000)return reject('source_stale','全場資料已過期，等待來源更新');
 if(game.state!=='scheduled'||!game.timeConfirmed||!Number.isFinite(start)||start<=now)return reject('fixture_ineligible','目前賽事狀態不提供賽前全場分析');
 if(!Array.isArray(snapshot.sportGames))return reject('sport_unavailable','目前連接的來源尚未提供此球類全場資料');
 const rows=snapshot.sportGames.filter((r:any)=>r&&r.league===sport&&typeof r.home==='string'&&typeof r.away==='string');
 if(!rows.length)return reject('sport_unavailable','目前來源未提供此球類的可配對賽事');
 const home=sportTeamKey(game.home.name,sport),away=sportTeamKey(game.away.name,sport);
 const sameTeams=(r:any)=>sportTeamKey(r.home,sport)===home&&sportTeamKey(r.away,sport)===away;
 const sameCompetition=(r:any)=>sport!=='FOOTBALL'||r.competition===game.league;
 const sameTime=(r:any)=>Number.isFinite(sourceTime(r.start))&&Math.abs(sourceTime(r.start)-start)<=600000;
 let event:SportEvent|null;try{event=matchSportEvent(snapshot,game,sport,now);}catch{return reject('source_invalid','來源全場資料格式異常，等待更新');}
 if(!event){
  const exact=rows.filter((r:any)=>r.live===false&&sameCompetition(r)&&sameTeams(r)&&sameTime(r));
  if(exact.length>1)return reject('fixture_ambiguous','來源有重複對戰，暫停配對');
  if(rows.some((r:any)=>sameTeams(r)&&sameTime(r)&&!sameCompetition(r)))return reject('competition_mismatch','對戰的聯賽分類不一致，暫停配對');
  if(rows.some((r:any)=>sameTeams(r)&&sameCompetition(r)&&sameTime(r)&&r.live!==false))return reject('source_not_pregame','來源尚未確認為賽前資料，暫停配對');
  if(rows.some((r:any)=>sameTeams(r)&&sameCompetition(r)&&!sameTime(r)))return reject('time_mismatch','對戰開賽時間不一致，暫停配對');
  if(rows.some((r:any)=>sameCompetition(r)&&sameTime(r)&&sportTeamKey(r.home,sport)===away&&sportTeamKey(r.away,sport)===home))return reject('orientation_mismatch','來源主客隊順序不一致，暫停配對');
  if(rows.some((r:any)=>sameCompetition(r)&&sameTime(r)&&(sportTeamKey(r.home,sport)===home||sportTeamKey(r.away,sport)===away)))return reject('team_name_mismatch','來源隊名或對手尚未對應，暫停配對');
  return out;
 }
 out.event=event;out.code='matched';out.message='';
 const row=rows.find((r:any)=>r.id===event!.id&&sameTeams(r)&&sameTime(r)&&sameCompetition(r)&&r.live===false),types=marketTypes(sport);
 for(const kind of ['spread','total','moneyline'] as const){
  let code:QuoteState='missing';
  if(event[kind]){code='ready';out.availableCount++;}
  else if(row?.displayMarkets!==undefined&&!Array.isArray(row.displayMarkets))code='invalid';
  else{
   const markets=(row?.displayMarkets||[]).filter((m:any)=>m?.period==='full'&&m.type===types[kind]);
   if(markets.length>1)code='ambiguous';
   else if(markets.length===1){
    const quotes=markets[0].quotes;
    if(!Array.isArray(quotes))code='invalid';
    else if(quotes.length){const primary=quotes.filter((q:any)=>q?.primary===true);code=primary.length>1?'ambiguous':primary.length!==1?'invalid':primary[0].open===false?'closed':'invalid';}
   }
  }
  out.markets[kind]={code,message:statusText[code]};
 }
 return out;
}
// Metadata only for auditing current source coverage. No raw responses, prices,
// accounts, tokens, URLs, or member IDs are retained. Bounds are explicit.
export function sportSourceAudit(snapshot:any,now=Date.now()){
 const supported=new Set<string>(FOOTBALL_LEAGUES.map(l=>l.code));
 const rows=(Array.isArray(snapshot?.sportGames)?snapshot.sportGames:[]).filter((r:any)=>r&&(['NBA','WNBA'].includes(r.league)||r.league==='FOOTBALL'&&supported.has(r.competition)));
 const safe=(v:unknown,n=100)=>typeof v==='string'?v.slice(0,n):'';
 const unrecognizedTeamNames=[...new Map(rows.flatMap((r:any)=>[r.home,r.away].filter(name=>!registeredNames[r.league as MarketSport].has(sportTeamKey(safe(name),r.league))).map(name=>[`${r.league}:${safe(name)}`,{sport:r.league,name:safe(name)}] as const))).values()];
 return {schema:1,revision:'sport-pairing-v4',fetchedAt:safe(snapshot?.fetchedAt,40),fixtureCount:rows.length,truncated:rows.length>120,unrecognizedTeamNameCount:unrecognizedTeamNames.length,unrecognizedTeamNamesTruncated:unrecognizedTeamNames.length>120,unrecognizedTeamNames:unrecognizedTeamNames.slice(0,120),fixtures:rows.slice(0,120).map((r:any)=>{
  const start=sourceTime(r.start),game:SportFixture={id:String(r.id),league:r.competition,start:Number.isFinite(start)?new Date(start).toISOString():'',state:'scheduled',timeConfirmed:true,home:{name:safe(r.home)},away:{name:safe(r.away)}};
  const result=sportMarketStatus(snapshot,game,r.league,now);
  return {id:Number.isSafeInteger(r.id)?r.id:null,sport:r.league,competition:safe(r.competition),leagueName:safe(r.leagueName),home:safe(r.home),away:safe(r.away),start:safe(r.start,40),live:typeof r.live==='boolean'?r.live:null,availableMarkets:result.availableCount,marketStates:Object.fromEntries(Object.entries(result.markets).map(([k,v])=>[k,v.code]))};
 })};
}
export function settleSportGrid(grid:SportGrid,quote:SportQuote,side:'home'|'away'|'over'|'under'):SportOutcomes|null{
 if(quote.kind==='moneyline'||!grid.length||grid.some(r=>!Number.isFinite(r.value)||!Number.isFinite(r.p)||r.p<0)||Math.abs(grid.reduce((n,r)=>n+r.p,0)-1)>1e-6)return null;
 const out:SportOutcomes={win:0,partialWin:0,push:0,partialLoss:0,loss:0,ev:0},direction=side==='away'||side==='under'?-1:1,price=direction===1?quote.home:quote.away;
 for(const row of grid){
  const parts=quote.parts||[quote.line],fraction=parts.reduce((n,line)=>{const delta=quote.kind==='spread'?row.value+line:row.value-line;return n+direction*(Math.abs(delta)<1e-9?quote.boundary:Math.sign(delta));},0)/parts.length;
  out[fraction===1?'win':fraction===-1?'loss':fraction>0?'partialWin':fraction<0?'partialLoss':'push']+=row.p;
  out.ev+=netProfit(fraction,price)*row.p;
 }
 return out;
}
const cdf=(z:number)=>{const sign=z<0?-1:1,x=Math.abs(z)/Math.SQRT2,t=1/(1+.3275911*x),erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);return .5*(1+sign*erf);};
export function basketballMarketGrid(mean:number,sigma:number,kind:'margin'|'total',homeProbability?:number):SportGrid{
 if(!Number.isFinite(mean)||!Number.isFinite(sigma)||sigma<=0)return [];
 const low=Math.floor(mean-9*sigma),high=Math.ceil(mean+9*sigma);
 if(high-low>2000)return [];
 const grid:SportGrid=[];
 for(let value=low;value<=high;value++){
  if(kind==='margin'&&value===0||kind==='total'&&value<=0)continue;
  grid.push({value,p:cdf((value+.5-mean)/sigma)-cdf((value-.5-mean)/sigma)});
 }
 const sum=grid.reduce((n,r)=>n+r.p,0);if(sum<=0)return [];
 if(kind==='margin'&&Number.isFinite(homeProbability)&&homeProbability!>=0&&homeProbability!<=1){const homeMass=grid.filter(r=>r.value>0).reduce((n,r)=>n+r.p,0),awayMass=sum-homeMass;if(homeMass<=0||awayMass<=0)return [];return grid.map(r=>({...r,p:r.p*(r.value>0?homeProbability!/homeMass:(1-homeProbability!)/awayMass)}));}
 return grid.map(r=>({...r,p:r.p/sum}));
}
export function footballMarketGrids(analysis:any):{margin:SportGrid;total:SportGrid}|null{
 const d=analysis?.scoreDistribution,e=analysis?.expected;
 if(!d||!e||![d.home,d.away,e.home,e.away].every(n=>Number.isFinite(n)&&n>=0)||Math.abs(d.home-e.home)>1e-6||Math.abs(d.away-e.away)>1e-6||!Array.isArray(d.scores)||!d.scores.length)return null;
 const rows=d.scores;
 const seen=new Set<string>();
 for(const r of rows){
  if(!r||!Number.isInteger(r.home)||!Number.isInteger(r.away)||r.home<0||r.away<0||!Number.isFinite(r.probability)||r.probability<0||r.probability>1)return null;
  const key=`${r.home}:${r.away}`;if(seen.has(key))return null;seen.add(key);
 }
 if(Math.abs(rows.reduce((n:number,r:any)=>n+r.probability,0)-1)>1e-6)return null;
 const p=analysis.probabilities;
 if(!p||(['home','draw','away'] as const).some(side=>!Number.isFinite(p[side])||p[side]<0||p[side]>1||Math.abs(rows.filter((r:any)=>side==='home'?r.home>r.away:side==='away'?r.home<r.away:r.home===r.away).reduce((n:number,r:any)=>n+r.probability,0)-p[side])>1e-5))return null;
 for(const side of ['over25','under25','btts'] as const){
  if(p[side]===undefined)continue;
  const mass=rows.filter((r:any)=>side==='over25'?r.home+r.away>2:side==='under25'?r.home+r.away<=2:r.home>0&&r.away>0).reduce((n:number,r:any)=>n+r.probability,0);
  if(!Number.isFinite(p[side])||Math.abs(mass-p[side])>1e-5)return null;
 }
 return {margin:rows.map((r:any)=>({value:r.home-r.away,p:r.probability})),total:rows.map((r:any)=>({value:r.home+r.away,p:r.probability}))};
}
