export type LiveCount={balls:number|null;strikes:number|null;outs:number|null};
export type LiveBases={first:boolean;second:boolean;third:boolean}|null;
export type LivePerson={id:number|null;name:string};
export type LivePitch={id:string;number:number|null;description:string;call:string;type:string;speed:number|null;count:LiveCount};
export type LivePlay={
 id:string;index:number;inning:number;half:'top'|'bottom';complete:boolean;
 batter:LivePerson;pitcher:LivePerson;position:string|null;battingOrder:number|null;
 event:string;eventType:string;description:string;rbi:number|null;scoring:boolean;
 awayScore:number|null;homeScore:number|null;count:LiveCount;bases:LiveBases;
 pitches:LivePitch[];actions:{id:string;event:string;eventType:string;description:string}[];
};
const integer=(value:any,max=999)=>Number.isInteger(value)&&value>=0&&value<=max?value:null;
const person=(value:any):LivePerson=>({id:Number.isInteger(value?.id)&&value.id>0?value.id:null,name:typeof value?.fullName==='string'?value.fullName:'尚未提供'});
const counts=(value:any):LiveCount=>({balls:integer(value?.balls,4),strikes:integer(value?.strikes,3),outs:integer(value?.outs,3)});

export function parseLivePlays(data:any):{plays:LivePlay[];currentPlay:LivePlay|null;playsAvailable:boolean}{
 const source=data.liveData?.plays,all=Array.isArray(source?.allPlays)?source.allPlays:[];
 const byIndex=new Map<number,any>();
 for(const play of [...all,...(source?.currentPlay?[source.currentPlay]:[])]){
  const index=integer(play?.about?.atBatIndex,10000);
  if(index!==null&&Number.isInteger(play.about.inning)&&play.about.inning>0&&['top','bottom'].includes(play.about.halfInning))byIndex.set(index,play);
 }
 const plays=[...byIndex.entries()].sort(([a],[b])=>a-b).map(([index,play]):LivePlay=>{
  const complete=play.about.isComplete===true,match=play.matchup,result=play.result||{};
  const events=Array.isArray(play.playEvents)?play.playEvents:[];
  const side=play.about.halfInning==='top'?'away':'home';
  const player=data.liveData?.boxscore?.teams?.[side]?.players?.['ID'+match?.batter?.id];
  const order=typeof player?.battingOrder==='string'?Number(player.battingOrder):null;
  // postOn* is this appearance's own post-play snapshot, never today's bases.
  const bases=complete&&match&&Array.isArray(play.runners)?{first:!!match.postOnFirst?.id,second:!!match.postOnSecond?.id,third:!!match.postOnThird?.id}:null;
  const seen=new Set<string>();
  const pitches:LivePitch[]=events.filter((e:any)=>{
   if(e.isPitch!==true)return false;
   const key=String(e.playId??e.index);if(seen.has(key))return false;seen.add(key);return true;
  }).map((e:any)=>({id:String(e.playId??`${index}:${e.index}`),number:integer(e.pitchNumber,999),description:e.details?.description||'尚未提供',call:e.details?.call?.code||e.details?.code||'',type:e.details?.type?.description||'',speed:typeof e.pitchData?.startSpeed==='number'&&Number.isFinite(e.pitchData.startSpeed)&&e.pitchData.startSpeed>0&&e.pitchData.startSpeed<130?e.pitchData.startSpeed:null,count:counts(e.count)}));
  return {id:`${data.gamePk}:${index}`,index,inning:play.about.inning,half:play.about.halfInning,complete,batter:person(match?.batter),pitcher:person(match?.pitcher),position:player?.position?.abbreviation??null,battingOrder:order!==null&&Number.isInteger(order)&&order>=100&&order<1000?Math.floor(order/100):null,event:result.event||'',eventType:result.eventType||'',description:result.description||'',rbi:integer(result.rbi),scoring:play.about.isScoringPlay===true||events.some((e:any)=>e.details?.isScoringPlay===true),awayScore:integer(result.awayScore),homeScore:integer(result.homeScore),count:counts(play.count),bases,pitches,actions:events.filter((e:any)=>e.type==='action'&&e.details?.description).map((e:any)=>({id:`${index}:${e.index}`,event:e.details.event||'',eventType:e.details.eventType||'',description:e.details.description}))};
 });
 const currentIndex=source?.currentPlay?.about?.atBatIndex;
 return {plays,currentPlay:plays.find(p=>p.index===currentIndex)??null,playsAvailable:Array.isArray(source?.allPlays)};
}

export function parseLiveGame(data:any,gamePk:number,now=Date.now()){
 if(data?.gamePk!==gamePk||!data.gameData?.status||!data.liveData?.linescore||!data.gameData?.teams?.home?.id||!data.gameData?.teams?.away?.id)throw new Error('詳細比賽資料不完整或賽事編號不符');
 const game=data.gameData,live=data.liveData,line=live.linescore,box=live.boxscore?.teams||{};
 const teams=Object.fromEntries(['away','home'].map(side=>{
  const b=box[side]||{};
  const players=Object.values(b.players||{}).map((p:any)=>({id:p.person?.id,name:p.person?.fullName,battingOrder:p.battingOrder??null,position:p.position?.abbreviation??null,batSide:game.players?.['ID'+p.person?.id]?.batSide?.code??null,pitchHand:game.players?.['ID'+p.person?.id]?.pitchHand?.code??null,gameStats:p.stats||{}}));
  return [side,{id:game.teams[side].id,battingOrder:b.battingOrder||[],pitchers:b.pitchers||[],bullpen:b.bullpen||[],players}];
 }));
 const pitcherId=line.defense?.pitcher?.id;
 const currentPitcher=Object.values(teams).flatMap((t:any)=>t.players).find((p:any)=>p.id===pitcherId);
 const pitches=currentPitcher?.gameStats?.pitching?.numberOfPitches??currentPitcher?.gameStats?.pitching?.pitchesThrown;
 const pitchCount=Number.isInteger(pitches)&&pitches>=0?pitches:null;
 return {gamePk,scheduledStart:game.datetime?.dateTime??null,fetchedAt:new Date(now).toISOString(),sourceTimestamp:data.metaData?.timeStamp??null,status:game.status,teams,linescore:line,pitchCount,venue:game.venue?.name??null,weather:game.weather??null,probablePitchers:game.probablePitchers??{},...parseLivePlays(data),source:`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`};
}
export type LiveGameDetail=ReturnType<typeof parseLiveGame>;
export function mergeLiveGame(game:any,detail:ReturnType<typeof parseLiveGame>){
 if(detail.gamePk!==game.gamePk||detail.teams.home.id!==game.teams.home.team.id||detail.teams.away.id!==game.teams.away.team.id)throw new Error('比賽主客隊對應不符');
 return {...game,status:detail.status,linescore:detail.linescore,teams:{away:{...game.teams.away,score:detail.linescore.teams?.away?.runs??game.teams.away.score},home:{...game.teams.home,score:detail.linescore.teams?.home?.runs??game.teams.home.score}},detailFetchedAt:detail.fetchedAt,pitchCount:detail.pitchCount,detailError:false};
}
