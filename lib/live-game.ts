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
 return {gamePk,scheduledStart:game.datetime?.dateTime??null,fetchedAt:new Date(now).toISOString(),sourceTimestamp:data.metaData?.timeStamp??null,status:game.status,teams,linescore:line,pitchCount,weather:game.weather??null,probablePitchers:game.probablePitchers??{},source:`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`};
}
export function mergeLiveGame(game:any,detail:ReturnType<typeof parseLiveGame>){
 if(detail.gamePk!==game.gamePk||detail.teams.home.id!==game.teams.home.team.id||detail.teams.away.id!==game.teams.away.team.id)throw new Error('比賽主客隊對應不符');
 return {...game,status:detail.status,linescore:detail.linescore,teams:{away:{...game.teams.away,score:detail.linescore.teams?.away?.runs??game.teams.away.score},home:{...game.teams.home,score:detail.linescore.teams?.home?.runs??game.teams.home.score}},detailFetchedAt:detail.fetchedAt,pitchCount:detail.pitchCount,detailError:false};
}
