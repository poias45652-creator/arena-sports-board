import type {FootballGame} from './football';

// A descriptive market reference, never an independent model input or forecast.
export type FootballMarketReference={
  gameId:string;homeId:string;awayId:string;start:string;fetchedAt:string;
  provider:string;sourceUrl:string;probabilities:{home:number;draw:number;away:number};
  homeHandicap:number|null;awayHandicap:number|null;total:number|null;
};
function impliedAmerican(value:unknown){
  if(typeof value!=='string'&&typeof value!=='number')return null;
  if(!/^[+-]?\d+(?:\.\d+)?$/.test(String(value)))return null;
  const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)<100||Math.abs(n)>100000)return null;
  return n>0?100/(n+100):-n/(-n+100);
}
function line(value:unknown){
  if(typeof value!=='number'&&typeof value!=='string'||String(value).trim()==='')return null;
  const n=Number(value);return Number.isFinite(n)&&Math.abs(n)<=10&&Number.isInteger(n*4)?n:null;
}
export function parseFootballMarketReference(event:any,game:FootballGame,fetchedAt:string):FootballMarketReference|null{
  const c=event?.competitions?.[0],competitors=c?.competitors;
  if(game.state!=='scheduled'||!game.timeConfirmed||String(event?.id)!==game.id||Date.parse(c?.date||event?.date)!==Date.parse(game.start)||!Number.isFinite(Date.parse(fetchedAt))||Date.parse(fetchedAt)>=Date.parse(game.start)||!Array.isArray(competitors)||competitors.length!==2)return null;
  if(competitors.find((t:any)=>t.homeAway==='home')?.team?.id!==game.home.id||competitors.find((t:any)=>t.homeAway==='away')?.team?.id!==game.away.id)return null;
  // Never fill a missing current quote with an opening quote, or mix providers.
  const rows=(Array.isArray(c.odds)?c.odds:[]).filter((o:any)=>typeof o?.provider?.name==='string'&&o.provider.name.length<=60);
  for(const odds of rows){
    const moneyline=odds.moneyline,home=impliedAmerican(moneyline?.home?.close?.odds),draw=impliedAmerican(moneyline?.draw?.close?.odds),away=impliedAmerican(moneyline?.away?.close?.odds);
    if(home===null||draw===null||away===null)continue;
    const sum=home+draw+away;if(sum<1||sum>1.3)continue;
    const h=line(odds.pointSpread?.home?.close?.line),a=line(odds.pointSpread?.away?.close?.line),total=line(odds.overUnder),paired=h!==null&&a!==null&&Math.abs(h+a)<1e-9;
    return {gameId:game.id,homeId:game.home.id,awayId:game.away.id,start:game.start,fetchedAt,provider:odds.provider.name,sourceUrl:`https://www.espn.com/soccer/odds/_/gameId/${game.id}`,probabilities:{home:home/sum,draw:draw/sum,away:away/sum},homeHandicap:paired?h:null,awayHandicap:paired?a:null,total:total!==null&&total>0?total:null};
  }
  return null;
}
export function currentFootballMarketReference(game:FootballGame,now:number){
  const r=game.marketReference,captured=Date.parse(r?.fetchedAt||'');
  if(!r||!Number.isFinite(now)||!Number.isFinite(captured)||now-captured>=120000||captured>now+5000||game.state!=='scheduled'||!game.timeConfirmed||Date.parse(game.start)<=now||r.gameId!==game.id||r.homeId!==game.home.id||r.awayId!==game.away.id||r.start!==game.start)return null;
  const values=Object.values(r.probabilities);
  return values.length===3&&values.every(p=>Number.isFinite(p)&&p>0&&p<1)&&Math.abs(values.reduce((s,p)=>s+p,0)-1)<1e-9?r:null;
}
