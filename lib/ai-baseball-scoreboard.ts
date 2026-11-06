import {teamZh} from '@/app/zh';
import {aiDay,type AiMatch,type AiSnapshot} from './ai-assistant';
import {internationalTeam} from './international-teams';

type ScoreRow={id:string;start:string;state:'live'|'final';home:{id:string;name:string;score:number};away:{id:string;name:string;score:number};source:string;capturedAt:string};
const score=(n:unknown):n is number=>typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=100;
const states:Record<string,'live'|'final'>={'In Progress':'live','Game Over':'final','Final':'final','Completed Early':'final'};

export function mlbScoreRows(data:any,day:string):ScoreRow[]{
 if(data?.date!==day||!Array.isArray(data.games))return [];
 return data.games.flatMap((g:any)=>{
  const state=states[g.status?.detailedState];
  if(!state||g.status.abstractGameState!==(state==='live'?'Live':'Final')||!Number.isInteger(g.gamePk)||g.gamePk<=0)return [];
  const {away,home}=g.teams||{};
  if(!home?.team?.id||!away?.team?.id||home.team.id===away.team.id||!score(home.score)||!score(away.score))return [];
  const side=(r:any)=>({id:String(r.team.id),name:teamZh(r.team),score:r.score});
  return [{id:String(g.gamePk),start:g.gameDate,state,home:side(home),away:side(away),capturedAt:data.fetchedAt,source:'MLB 官方比分'}];
 });
}

export function npbScoreRows(feed:any,day:string):ScoreRow[]{
 if(feed?.league!=='NPB'||feed.date!==day||feed.stale||!Array.isArray(feed.games))return [];
 return feed.games.flatMap((g:any)=>{
  if(g.league!=='NPB'||g.date!==day||!/^\d+$/.test(g.id)||g.key!=='NPB:'+g.id||g.sourceStale||
     g.source?.provider!=='sportsnavi'||!['live','final'].includes(g.status))return [];
  const {away,home}=g;
  if(!home?.id||!away?.id||String(home.id)===String(away.id)||!home.name||!away.name||!score(home.score)||!score(away.score))return [];
  const side=(r:any)=>({id:String(r.id),name:internationalTeam(r.name,'NPB'),score:r.score});
  return [{id:String(g.id),start:g.startTime,state:g.status,home:side(home),away:side(away),capturedAt:g.source.fetchedAt,source:'Sportsnavi 比分'}];
 });
}

export function baseballScoreSnapshots(league:'MLB'|'NPB',day:string,rows:ScoreRow[],now=Date.now()):AiSnapshot[]{
 return rows.flatMap(g=>{
  const start=Date.parse(g.start),at=Date.parse(g.capturedAt);
  if(!(start<=at&&at<=now)||aiDay(start)!==day||now-at>(g.state==='live'?120000:900000)||rows.filter(other=>other.id===g.id).length!==1)return [];
  const {home,away,state}=g;
  const match:AiMatch={id:g.id,league,day,start:g.start,homeId:home.id,awayId:away.id,home:home.name,away:away.name};
  const outcome=home.score===away.score?'雙方平手':(home.score>away.score?home.name:away.name)+(state==='live'?'領先':'獲勝');
  const text=`${g.source}，${state==='live'?'進行中':'已完賽'}：${away.name}（客）${away.score} 比 ${home.score} ${home.name}（主）。${outcome}。`;
  return [{match,capturedAt:g.capturedAt,model:'賽事紀錄',evidence:[{id:'board-'+state,topic:'data',text}],suggestion:null}];
 });
}
