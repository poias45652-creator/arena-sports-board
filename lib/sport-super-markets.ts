import {parseSourceLine,netProfit,type ParsedLine} from './settlement';
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
const aliases:Record<string,string>={'聖馬力諾':'聖馬利諾','意大利':'義大利','格魯吉亞':'喬治亞','克羅地亞':'克羅埃西亞','斯洛文尼亞':'斯洛維尼亞','北馬其頓共和國':'北馬其頓','波黑':'波士尼亞與赫塞哥維納','黑山':'蒙特內哥羅','塞浦路斯':'賽普勒斯','法羅群島':'法羅群島','多蒙特':'多特蒙德','利華古遜':'勒沃庫森','阿仙奴':'阿森納','車路士':'切爾西','愛華頓':'艾佛頓','紐卡素':'紐卡索聯','阿士東維拉':'阿斯頓維拉','白禮頓':'布萊頓','富咸':'富勒姆','賓福特':'布倫特福德','韋斯咸':'西漢姆聯','列斯聯':'里茲聯','般尼':'伯恩利','新特蘭':'桑德蘭','巴塞羅那':'巴塞隆納','皇家貝蒂斯':'皇家貝提斯','維拉利爾':'比利亞雷亞爾','切爾達':'塞爾塔','祖雲達斯':'尤文圖斯','拿玻里':'拿坡里','費倫天拿':'佛羅倫斯','博洛尼亞':'波隆那','烏甸尼斯':'烏迪內斯','萊比錫':'RB萊比錫','慕遜加柏':'門興','弗賴堡':'弗萊堡','巴黎聖日門':'巴黎聖日耳曼'};
export function sportTeamKey(name:string){const key=name.normalize('NFKC').replace(/\(主\)|（主）/g,'').replace(/\s/g,'');return aliases[key]??key;}
export function matchSportEvent(snapshot:any,game:SportFixture,sport:'NBA'|'WNBA'|'FOOTBALL',now=Date.now()):SportEvent|null{
 const captured=Date.parse(snapshot?.fetchedAt||''),start=Date.parse(game.start);
 if(!Number.isFinite(captured)||now-captured< -60000||now-captured>=150000||game.state!=='scheduled'||!game.timeConfirmed||!Number.isFinite(start)||start<=now||!Array.isArray(snapshot?.sportGames))return null;
 const matches=snapshot.sportGames.filter((r:any)=>{
  if(r.league!==sport||r.live!==false||sport==='FOOTBALL'&&r.competition!==game.league||typeof r.home!=='string'||typeof r.away!=='string'||typeof r.start!=='string'||!/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(r.start))return false;
  const sourceStart=Date.parse(r.start.replaceAll('/','-').replace(' ','T')+'+08:00');
  return Number.isFinite(sourceStart)&&Math.abs(sourceStart-start)<=600000&&sportTeamKey(r.home)===sportTeamKey(game.home.name)&&sportTeamKey(r.away)===sportTeamKey(game.away.name);
 });
 if(matches.length!==1)return null;
 const r=matches[0],types=sport==='FOOTBALL'?{spread:101,total:102,moneyline:110}:{spread:103,total:104,moneyline:111};
 const read=(kind:SportQuote['kind']):SportQuote|null=>{
  const markets=(r.displayMarkets||[]).filter((m:any)=>m.period==='full'&&m.type===types[kind]);
  if(markets.length!==1)return null;
  const primary=(markets[0].quotes||[]).filter((q:any)=>q.primary===true);
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
 if(!d||!e||Math.abs(d.home-e.home)>1e-6||Math.abs(d.away-e.away)>1e-6||!Array.isArray(d.scores))return null;
 const rows=d.scores;
 if(rows.some((r:any)=>!Number.isInteger(r.home)||!Number.isInteger(r.away)||!Number.isFinite(r.probability)||r.probability<0)||Math.abs(rows.reduce((n:number,r:any)=>n+r.probability,0)-1)>1e-6)return null;
 const p=analysis.probabilities;
 if(!p||(['home','draw','away'] as const).some(side=>Math.abs(rows.filter((r:any)=>side==='home'?r.home>r.away:side==='away'?r.home<r.away:r.home===r.away).reduce((n:number,r:any)=>n+r.probability,0)-p[side])>1e-5))return null;
 return {margin:rows.map((r:any)=>({value:r.home-r.away,p:r.probability})),total:rows.map((r:any)=>({value:r.home+r.away,p:r.probability}))};
}
