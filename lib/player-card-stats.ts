/** Hydrated MLB roster stats must match this person, team, season and game type. */
export function mlbRosterCardStats(person:any,position:string,team:number,season:number,gameType:string){
 const group=position==='P'?'pitching':'hitting';
 const rows=(person?.stats||[]).filter((g:any)=>g.group?.displayName===group&&g.type?.displayName==='season')
  .flatMap((g:any)=>g.splits||[]).filter((r:any)=>Number(r.season)===season&&r.gameType===gameType&&Number(r.player?.id)===Number(person.id)&&Number(r.team?.id)===team);
 return rows.length===1?rows[0].stat:null;
}
