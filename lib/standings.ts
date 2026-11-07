export const divisions:Record<number,string>={201:'美聯東區',202:'美聯中區',200:'美聯西區',204:'國聯東區',205:'國聯中區',203:'國聯西區'};
// Fetch the season's score fields only. An offseason calendar window contains no regular-season games.
export function standingsScheduleUrl(season:number) {
 const query=new URLSearchParams({
  sportId:'1', gameType:'R', season:String(season),
  fields:'dates,games,gamePk,gameType,season,gameDate,resumeDate,officialDate,status,abstractGameState,codedGameState,teams,home,away,team,id,score',
 });
 return `https://statsapi.mlb.com/api/v1/schedule?${query}`;
}
export function parseStandings(raw:any,recent:any,season:number){
 const dates=Array.isArray(recent?.dates)?recent.dates:[];
 const completed=dates.flatMap((d:any)=>d.games||[]).filter((g:any)=>
  Number(g.season)===season && g.gameType==='R' && g.status?.abstractGameState==='Final' &&
  ['F','O'].includes(g.status.codedGameState) && Number.isInteger(g.gamePk) &&
  [g.teams?.home,g.teams?.away].every(side=>Number.isInteger(side?.team?.id)&&Number.isInteger(side.score)&&side.score>=0)
 );
 const unique=new Map<number,any>();for(const g of completed)unique.set(g.gamePk,g);
 const ordered=[...unique.values()].sort((a,b)=>Date.parse(a.resumeDate||a.gameDate)-Date.parse(b.resumeDate||b.gameDate)||a.gamePk-b.gamePk);
 const rows=(raw.records||[]).flatMap((group:any)=>(group.teamRecords||[]).map((r:any)=>{
  if(Number(r.season)!==season||!Number.isInteger(r.wins)||!Number.isInteger(r.losses)||r.wins<0||r.losses<0)throw new Error('戰績資料格式不符');
  const lastFive=ordered.filter(g=>[g.teams.home.team.id,g.teams.away.team.id].includes(r.team.id)).slice(-5).map(g=>{const side=g.teams.home.team.id===r.team.id?'home':'away',other=side==='home'?'away':'home',score=g.teams[side].score,against=g.teams[other].score;return {gameId:g.gamePk,date:g.officialDate,result:score>against?'W':score<against?'L':'T',score,against};});
  return {id:r.team.id,name:r.team.name,leagueId:group.league.id,divisionId:group.division.id,wins:r.wins,losses:r.losses,pct:r.wins+r.losses?r.wins/(r.wins+r.losses):null,streak:r.streak?.streakCode||null,rank:{all:Number(r.sportRank),league:Number(r.leagueRank),division:Number(r.divisionRank)},back:{all:r.sportGamesBack,league:r.leagueGamesBack,division:r.divisionGamesBack},lastFive,sourceUpdatedAt:r.lastUpdated||null};
 }));
 if(rows.length!==30||new Set(rows.map((r:any)=>r.id)).size!==30)throw new Error('尚未取得完整 30 隊戰績');
 const recentAvailable=Array.isArray(recent?.dates) && rows.every((r:any)=>r.lastFive.length>=Math.min(5,r.wins+r.losses));
 return {season,rows,fetchedAt:new Date().toISOString(),recentAvailable,source:'https://statsapi.mlb.com/api/v1/standings',recentSource:standingsScheduleUrl(season),recentOrder:'oldest_to_newest'};
}
