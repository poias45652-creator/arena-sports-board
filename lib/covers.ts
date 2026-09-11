// Covers prices have no verified bookmaker or closing timestamp; research only.
export const coversTeams:Record<number,string>={108:'los-angeles-angels',109:'arizona-diamondbacks',110:'baltimore-orioles',111:'boston-red-sox',112:'chicago-cubs',113:'cincinnati-reds',114:'cleveland-guardians',115:'colorado-rockies',116:'detroit-tigers',117:'houston-astros',118:'kansas-city-royals',119:'los-angeles-dodgers',120:'washington-nationals',121:'new-york-mets',133:'athletics-athletics',134:'pittsburgh-pirates',135:'san-diego-padres',136:'seattle-mariners',137:'san-francisco-giants',138:'st.-louis-cardinals',139:'tampa-bay-rays',140:'texas-rangers',141:'toronto-blue-jays',142:'minnesota-twins',143:'philadelphia-phillies',144:'atlanta-braves',145:'chicago-white-sox',146:'miami-marlins',147:'new-york-yankees',158:'milwaukee-brewers'};
export const coversUrl=(id:number)=>`https://www.covers.com/sport/baseball/mlb/teams/main/${coversTeams[id]}`;
const clean=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,x)=>String.fromCodePoint(parseInt(x,16))).replace(/&#(\d+);/g,(_,x)=>String.fromCodePoint(+x)).replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
export function parseCoversHistory(html:string,teamId:number,year:number){
 if(!coversTeams[teamId]||html.length>4000000)throw new Error('Covers 資料超出範圍');
 if(!html.includes(`/mlb/standings/${year}`)||!html.includes(`"${coversTeams[teamId]}"`))throw new Error('Covers 球季或球隊不符');
 const section=html.split('id="past-results"')[1];
 const table=section?.match(/<h2>Regular Season<\/h2>[\s\S]*?<table\b[^>]*>([\s\S]*?)<\/table>/)?.[1];
 if(!table||!table.includes('Opp. Pitcher'))throw new Error('Covers 例行賽表格格式改變');
 const seen=new Set<string>();
 const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].flatMap(m=>{
  const c=[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1]);if(!c.length)return [];
  if(c.length!==7)throw new Error('Covers 賽果欄位改變');
  const id=c[2].match(/\/mlb\/matchup\/(\d+)/)?.[1];
  const score=clean(c[2]).match(/^([WL])\s+(\d+)-(\d+)$/);
  if(!score)return []; // Exclude postponed, unfinished, or unsupported records.
  const opponent=c[1].match(/<a[^>]*href="\/sport\/baseball\/mlb\/teams\/main\/([^"/]+)"[^>]*>([\s\S]*?)<\/a>/);
  const opponentId=Number(Object.keys(coversTeams).find(k=>coversTeams[+k]===opponent?.[1]));
  const dateText=clean(c[0]),date=new Date(`${dateText} ${year} 12:00:00 GMT`);
  if(!id||!opponentId||!Number.isFinite(date.getTime())||seen.has(id))throw new Error('Covers 賽事無法唯一對應');seen.add(id);
  const scored=+score[2],allowed=+score[3];if((scored>allowed)!==(score[1]==='W'))throw new Error('Covers 比分與勝負不符');
  const ml=clean(c[3]).match(/^([WLP])\s+([+-]?\d+)$/),total=clean(c[4]).match(/^([OUP])\s+(\d+(?:\.5)?)$/);
  const totalLine=total?Number(total[2]):null;
  const calculated=totalLine===null?null:scored+allowed>totalLine?'O':scored+allowed<totalLine?'U':'P';
  return [{coversGameId:id,date:date.toISOString().slice(0,10),teamId,opponentId,venue:clean(opponent?.[2]||'').startsWith('@')?'away':'home',scored,allowed,result:score[1],moneylineAmerican:ml&&Math.abs(+ml[2])>=100?+ml[2]:null,totalLine,totalResult:total?.[1]??null,totalResultMatches:calculated!==null&&calculated===total?.[1],pitcher:clean(c[5]),opponentPitcher:clean(c[6]),source:`https://www.covers.com/sport/baseball/mlb/matchup/${id}`}];
 });
 if(!rows.length)throw new Error('Covers 沒有可用完場資料');
 return {teamId,year,rows,source:coversUrl(teamId),fetchedAt:new Date().toISOString(),bookmaker:null,priceTimestamp:null,isClosingPrice:null,runLine:null,totalOdds:null,modelApplied:false,status:'research_only'};
}
