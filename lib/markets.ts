import type { Match } from './baseball';
import type {Quote} from './pinnacle';
export type RunRow={id:number;scored:number;allowed:number;batGames:number;pitchGames:number};
export type RunSnapshot={rows:RunRow[];league:number;year:number;fetchedAt:string;source:string};
export type Outcome={away:number;home:number;p:number};
export type MarketPick={gameId:number;market:'spread'|'total';side:'away'|'home'|'over'|'under';line:number;quote?:string;boundary?:number;parts?:number[];display?:string};
export type Settlement={win:number;push:number;loss:number;partialWin:number;partialLoss:number;winWeight:number;lossWeight:number};
export function parseRuns(json:any):RunRow[]{
 const blocks=json?.stats;if(!Array.isArray(blocks))throw new Error('得失分資料格式錯誤');
 const hit=blocks.find((s:any)=>s.group?.displayName==='hitting')?.splits;
 const pitch=blocks.find((s:any)=>s.group?.displayName==='pitching')?.splits;
 if(!Array.isArray(hit)||!Array.isArray(pitch))throw new Error('缺少攻守得分資料');
 const valid=(s:any)=>Number.isInteger(s?.runs)&&s.runs>=0&&Number.isInteger(s?.gamesPlayed)&&s.gamesPlayed>=20;
 const rows=hit.flatMap((h:any)=>{const p=pitch.find((p:any)=>p.team?.id===h.team?.id);return h.team?.id&&valid(h.stat)&&valid(p?.stat)?[{id:h.team.id,scored:h.stat.runs,allowed:p.stat.runs,batGames:h.stat.gamesPlayed,pitchGames:p.stat.gamesPlayed}]:[];});
 if(rows.length!==30||new Set(rows.map(r=>r.id)).size!==30)throw new Error('球隊得失分未齊，暫停估算');return rows;
}
export function expectedRuns(g:Match,s:RunSnapshot){
 if(s.year!==g.season||!Number.isFinite(s.league)||s.league<=0)return null;
 const a=s.rows.find(r=>r.id===g.away.id),h=s.rows.find(r=>r.id===g.home.id);if(!a||!h)return null;
 // Shrink each scoring rate by 20 team games to the current league average.
 const rate=(runs:number,games:number)=>(runs+20*s.league)/(games+20);
 const away=rate(a.scored,a.batGames)*rate(h.allowed,h.pitchGames)/s.league;
 const home=rate(h.scored,h.batGames)*rate(a.allowed,a.pitchGames)/s.league;
 if([away,home].some(v=>!Number.isFinite(v)||v<=0||v>15))return null;
 return {away,home};
}
export function scoreGrid(away:number,home:number):Outcome[]{
 if([away,home].some(v=>!Number.isFinite(v)||v<=0||v>15))return [];
 const poisson=(lambda:number)=>{const p=[Math.exp(-lambda)];for(let k=1;k<=70;k++)p.push(p[k-1]*lambda/k);return p;};
 const a=poisson(away),h=poisson(home),out:Outcome[]=[];
 // Simplified full-game tie settlement: one extra run, each team equally likely.
 for(let x=0;x<a.length;x++)for(let y=0;y<h.length;y++){const p=a[x]*h[y];if(x===y){out.push({away:x+1,home:y,p:p/2},{away:x,home:y+1,p:p/2});}else out.push({away:x,home:y,p});}
 const mass=out.reduce((s,o)=>s+o.p,0);return out.map(o=>({...o,p:o.p/mass}));
}
export function validLine(market:MarketPick['market'],line:number){return Number.isFinite(line)&&Number.isInteger(line*4)&&(market==='spread'?Math.abs(line)<=10:line>=0&&line<=30);}
export function scoreFraction(o:Pick<Outcome,'home'|'away'>,pick:MarketPick):number{
 const parts=pick.parts??(!Number.isInteger(pick.line*2)?[Math.floor(pick.line*2)/2,Math.ceil(pick.line*2)/2]:[pick.line]);
 return parts.reduce((sum,line)=>{const margin=pick.market==='spread'?o.home-o.away+line:o.home+o.away-line;const direction=pick.side==='away'||pick.side==='under'?-1:1;return sum+direction*(margin===0?(pick.boundary??0):Math.sign(margin));},0)/parts.length;
}
export function settle(grid:Outcome[],pick:MarketPick):Settlement|null{
 if(!grid.length||!validLine(pick.market,pick.line)||(pick.market==='spread'?!['away','home'].includes(pick.side):!['over','under'].includes(pick.side)))return null;
 if(!Number.isFinite(pick.boundary??0)||Math.abs(pick.boundary??0)>1||pick.parts?.some(n=>!validLine(pick.market,n)))return null;
 const out={win:0,push:0,loss:0,partialWin:0,partialLoss:0,winWeight:0,lossWeight:0};
 for(const o of grid){const fraction=scoreFraction(o,pick);out[fraction===1?'win':fraction===-1?'loss':fraction>0?'partialWin':fraction<0?'partialLoss':'push']+=o.p;out.winWeight+=Math.max(0,fraction)*o.p;out.lossWeight+=Math.max(0,-fraction)*o.p;}return out;
}
export function marketSuggestions(g:Match,grid:Outcome[],spread:number|null,total:number|null,quotes?:{spread:Quote|null;total:Quote|null}):{pick:MarketPick;result:Settlement}[]{
 const out:{pick:MarketPick;result:Settlement}[]=[];
 for(const market of ['spread','total'] as const){const line=market==='spread'?spread:total;if(line===null)continue;const sides=market==='spread'?['home','away'] as const:['over','under'] as const;
 const q=quotes?.[market];const options=sides.map(side=>{const pick:MarketPick={gameId:g.id,market,side,line,boundary:q?.boundary,parts:q?.parts,display:q?.display};return {pick,result:settle(grid,pick)};}).filter(x=>x.result!==null).sort((a,b)=>(b.result!.win+b.result!.partialWin)-(a.result!.win+a.result!.partialWin));
 if(options[0]&&options[0].result!.win+options[0].result!.partialWin>options[0].result!.loss+options[0].result!.partialLoss+.000001)out.push({pick:options[0].pick,result:options[0].result!});}
 return out;
}
