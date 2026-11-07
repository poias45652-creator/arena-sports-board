import {cachedMatchSource,matchSourceText} from './match-source-cache';

type Appearance={id:number;teamId:number;leagueId:number;matchDate?:{utcTime:string};homeScore?:number;awayScore?:number;
  minutesPlayed:number;playedInMatch:boolean;onBench:boolean;lineupPositionId:number|null};
export type FootballRole={games:number;starts:number;minutes:number;lastMatch:string};
type Profile={id:number;primaryTeam?:{teamId:number};recentMatches?:Appearance[]};
export function footballPlayerRole(data:Profile,player:number,team:number,league:number,cutoff:number):FootballRole|undefined{
  if(data?.id!==player||data.primaryTeam?.teamId!==team||!Array.isArray(data.recentMatches))return;
  const seen=new Set<number>();
  const matches=data.recentMatches.filter(g=>{
    const at=Date.parse(g.matchDate?.utcTime??'');
    return g.teamId===team&&g.leagueId===league&&Number.isSafeInteger(g.id)&&at<cutoff&&at>=cutoff-180*86400000&&
      Number.isInteger(g.homeScore)&&Number.isInteger(g.awayScore)&&Number.isInteger(g.minutesPlayed)&&g.minutesPlayed>=0&&g.minutesPlayed<=90&&
      (g.playedInMatch===true||g.onBench===true);
  }).sort((a,b)=>Date.parse(b.matchDate!.utcTime)-Date.parse(a.matchDate!.utcTime)).filter(g=>{
    if(seen.has(g.id))return false;seen.add(g.id);return true;
  }).slice(0,8);
  if(matches.length<3)return;
  return {games:matches.length,starts:matches.filter(g=>g.playedInMatch&&Number.isInteger(g.lineupPositionId)).length,
    minutes:matches.reduce((sum,g)=>sum+g.minutesPlayed,0),lastMatch:matches[0].matchDate!.utcTime};
}
let active=0;
const queue:(()=>void)[]=[];
const profile=cachedMatchSource(async id=>{
  if(active>=6)await new Promise<void>(r=>queue.push(r));else active++;
  try{return JSON.parse(await matchSourceText('https://www.fotmob.com/api/data/playerData?id='+id,4_000_000)) as Profile;}
  finally{const next=queue.shift();if(next)next();else active--;}
},3600000);
export async function loadFootballPlayerRole(player:number,team:number,league:number,now:number){
  try{return footballPlayerRole(await profile(String(player)),player,team,league,Math.floor(now/86400000)*86400000);}
  catch{return undefined;}
}
