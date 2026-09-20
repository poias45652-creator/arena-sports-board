import type {Match} from './baseball';
export const COVERS_ODDS_URL='https://www.covers.com/sport/baseball/mlb/odds';
const ids:Record<string,number>={LAA:108,ARI:109,BAL:110,BOS:111,CHC:112,CIN:113,CLE:114,COL:115,DET:116,HOU:117,KC:118,LAD:119,WSH:120,NYM:121,ATH:133,OAK:133,PIT:134,SD:135,SEA:136,SF:137,STL:138,TB:139,TEX:140,TOR:141,MIN:142,PHI:143,ATL:144,CHW:145,MIA:146,NYY:147,MIL:158};
const clean=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,x)=>String.fromCodePoint(parseInt(x,16))).replace(/&#(\d+);/g,(_,x)=>String.fromCodePoint(+x)).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
// Resolve Eastern wall clock using IANA rules, including daylight saving time.
function eastern(date:string,hour:number,minute:number){
 const wall=Date.parse(date+'T'+String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0')+':00Z');let utc=wall;
 for(let n=0;n<2;n++){const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(utc);const v=Object.fromEntries(p.map(x=>[x.type,x.value]));const local=Date.parse(`${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}:${v.second}Z`);utc+=wall-local;}
 return new Date(utc).toISOString();
}
export function parseCoversOdds(html:string,now=Date.now()){
 if(html.length>3000000||!html.includes('id="oddsScopeChangeField"')||!/<input\b[^>]*id="oddsScopeChangeField"[^>]*value="1"/.test(html))throw new Error('Covers 非全場資料或格式改變');
 const stamp=html.match(/Last updated ([A-Z][a-z]{2}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}) (AM|PM) ET/);
 if(!stamp)throw new Error('Covers 缺少來源更新時間');
 const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(stamp[1])+1;
 if(!month)throw new Error('Covers 日期無效');
 const date=`${stamp[3]}-${String(month).padStart(2,'0')}-${stamp[2].padStart(2,'0')}`;
 const sourceUpdatedAt=eastern(date,+stamp[4]%12+(stamp[6]==='PM'?12:0),+stamp[5]);
 const games=new Map<string,{coversGameId:string;awayId:number;homeId:number;start:string;markets:any[]}>();
 for(const market of ['moneyline','spread','total']){
  const table=html.match(new RegExp('<table\\b[^>]*id="'+market+'-table"[^>]*>([\\s\\S]*?)</table>'))?.[1];
  if(!table)throw new Error('Covers 資料表格缺漏');
  for(const row of table.matchAll(/<tr\b[^>]*class="oddsGameRow"[^>]*>([\s\S]*?)<\/tr>/g)){
   const cells=[...row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/g)];const left=cells[0]?.[2]||'';
   const teams=[...left.matchAll(/<strong>([A-Z]+)<\/strong>/g)].map(x=>ids[x[1]]);
   const id=left.match(/\/mlb\/matchup\/(\d+)/)?.[1];
   const time=clean(left.match(/class="td-cell game-time">([\s\S]*?)<div class="pitcher-label"/)?.[1]||'').match(/^Today,\s*(\d{1,2}):(\d{2})$/);
   // Do not guess dates for tomorrow, finals, live rows, or altered page layouts.
   if(!id||teams.length!==2||teams.some(x=>!x)||!time||+time[1]>23||+time[2]>59)continue;
   const start=eastern(date,+time[1],+time[2]);const game=games.get(id)||{coversGameId:id,awayId:teams[0],homeId:teams[1],start,markets:[]};
   if(game.awayId!==teams[0]||game.homeId!==teams[1]||game.start!==start)throw new Error('Covers 賽事欄位衝突');
   const opening=left.split('class="div-cell opening-lines-div"')[1];
   const open=opening?[...opening.matchAll(/<span class="(?:American )?__american"[^>]*>([\s\S]*?)<\/span>/g)].map(x=>clean(x[1])):[];
   // Covers currently labels all cells data-type="spread"; use the enclosing table and validate line syntax.
   for(const cell of cells.slice(1)){
    const book=cell[1].match(/data-book="([^"]+)"/)?.[1];if(!book||!cell[1].includes(`data-game="${id}"`))continue;
    const sides=[...cell[2].matchAll(/<div class="td-cell (away|home)-cell">([\s\S]*?)<\/div>/g)];
    if(sides.length!==2||sides[0][1]!=='away'||sides[1][1]!=='home')continue;
    if(market==='moneyline'&&sides.some(s=>!s[2].includes('odds-cta moneyline')))continue;
    const values=sides.map(s=>{
     const a=s[2].match(/<a\b[^>]*>([\s\S]*?)<\/a>/)?.[1]||'';
     const rawAmerican=clean(a.match(/<span class="American __american"[^>]*>([\s\S]*?)<\/span>/)?.[1]||'');
     const american=/^[+-]?\d+$/.test(rawAmerican)&&Math.abs(Number(rawAmerican))>=100?Number(rawAmerican):null;
     const decimalText=clean(a.match(/<span class="Decimal __decimal"[^>]*>([\s\S]*?)<\/span>/)?.[1]||'');
     const displayedDecimal=/^\d+(?:\.\d+)?$/.test(decimalText)?Number(decimalText):null;
     const percentageFormat=/^\d+(?:\.\d+)?%$/.test(rawAmerican);
     const decimal=american!==null?(american>0?1+american/100:1+100/Math.abs(american)):percentageFormat&&displayedDecimal!==null&&displayedDecimal>1?displayedDecimal:null;
     const lineText=clean(a.split('<span')[0]);const m=lineText.match(/^([ou])?\s*([+-]?\d+(?:\.\d+)?)$/);
     return {american,decimal,sourceFormat:american!==null?'american':'percentage_with_decimal',line:market==='moneyline'?null:m?+m[2]:null,direction:m?.[1]??null};
    });
    if(values.some(v=>v.decimal===null||!Number.isFinite(v.decimal)||v.decimal<=1))continue;
    if(market!=='moneyline'&&values.some(v=>v.line===null||!Number.isInteger(v.line*2)))continue;
    if(market==='spread'&&values[0].line!==-values[1].line!)continue;
    if(market==='total'&&(values[0].line!==values[1].line||values[0].direction!=='o'||values[1].direction!=='u'))continue;
    const previous=game.markets.find(v=>v.market===market&&v.bookmaker===clean(book));
    if(previous){if(JSON.stringify([previous.first,previous.second])!==JSON.stringify(values))throw new Error('Covers 同場同莊家資料衝突');continue;}
    game.markets.push({market,bookmaker:clean(book),period:'full_game',settlementVerified:false,feesVerified:false,recommendationEligible:false,first:values[0],second:values[1],firstSide:market==='total'?'over':'away',secondSide:market==='total'?'under':'home',opening:open.length===2?{first:open[0],second:open[1],bookmaker:null}:null,sourceDateRaw:cell[1].match(/data-date="(\d+)"/)?.[1]??null,priceUpdatedAt:null});
   }
   games.set(id,game);
  }
 }
 const rows=[...games.values()].filter(g=>g.markets.length);if(!rows.length){
  const table=html.match(/<table\b[^>]*id="moneyline-table"[^>]*>([\s\S]*?)<\/table>/)?.[1]||'';
  const body=table.split('<tbody')[1]||'';
  console.error('covers-parse',JSON.stringify({sourceUpdatedAt,matchedGames:games.size,gameRows:(body.match(/oddsGameRow/g)||[]).length,bookCells:(body.match(/data-book=/g)||[]).length,americanPrices:(body.match(/American __american/g)||[]).length,sample:clean(body.replace(/<img\b[^>]*>/g,'' )).slice(0,1400)}));
  throw new Error('Covers 沒有可解析賽前資料');
 }
 return {source:COVERS_ODDS_URL,fetchedAt:new Date(now).toISOString(),sourceUpdatedAt,games:rows,status:now-Date.parse(sourceUpdatedAt)>15*60000||Date.parse(sourceUpdatedAt)>now+60000?'stale':'ready',modelApplied:false,usage:'comparison_only',priceTimestampVerified:false};
}
export function matchCoversOdds(g:Match,s:ReturnType<typeof parseCoversOdds>|undefined,now=Date.now()){
 if(!s||s.status!=='ready'||now-Date.parse(s.fetchedAt)>10*60000||now-Date.parse(s.sourceUpdatedAt)>15*60000||Date.parse(s.sourceUpdatedAt)>now+60000||g.state!=='Preview'||Date.parse(g.date)<=now)return null;
 const hits=s.games.filter(x=>x.awayId===g.away.id&&x.homeId===g.home.id&&Math.abs(Date.parse(x.start)-Date.parse(g.date))<=600000);return hits.length===1?hits[0]:null;
}
