import type {ProfileGame} from './international-profile';

// Saved completed games fill gaps; a current observation always wins, including
// corrected scores and a status changed back from Final to suspended.
export function supplementCpblHistory(current:ProfileGame[],saved:ProfileGame[],season:number){
 const result=new Map(current.filter(g=>g.season===season).map(g=>[g.id,g]));
 for(const game of saved){
  if(game.season!==season||!game.completed||game.state!=='Final'||game.homeId===game.awayId||!Number.isInteger(game.homeScore)||!Number.isInteger(game.awayScore)||game.homeScore!<0||game.awayScore!<0||!game.date.startsWith(season+'-'))continue;
  if(!result.has(game.id))result.set(game.id,game);
 }
 return [...result.values()].sort((a,b)=>a.start.localeCompare(b.start)||a.id-b.id);
}
