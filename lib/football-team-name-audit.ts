import {FOOTBALL_TEAM_NAMES,type FootballGame} from './football';
const registered=new Set(FOOTBALL_TEAM_NAMES);
export function footballTeamNameAudit(games:FootballGame[]){
 const names=new Map<string,{league:string;id:string;name:string}>();
 for(const game of games)for(const team of [game.home,game.away])if(!registered.has(team.name)){
  names.set(game.league+':'+team.id+':'+team.name,{league:game.league,id:team.id.slice(0,20),name:team.name.slice(0,100)});
 }
 return {unrecognizedTeamNameCount:names.size,unrecognizedTeamNamesTruncated:names.size>120,teams:[...names.values()].slice(0,120)};
}
