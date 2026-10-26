import {MLB_TEAM_NAMES,mlbTeamName} from './mlb-team-names';
import {internationalTeam,internationalTeams} from './international-teams';
import {mlbSourceTeam} from './super007';

// Inspect every row before bounding the emitted metadata. No member fields,
// credentials or prices are read, and this audit cannot authorize a match.
export function baseballSourceAudit(snapshot:any){
 const registered:Record<string,Set<string>>={MLB:new Set(Object.values(MLB_TEAM_NAMES)),...Object.fromEntries(Object.entries(internationalTeams).map(([league,teams])=>[league,new Set(Object.values(teams))]))};
 const rows=[...(Array.isArray(snapshot?.games)?snapshot.games:[]).map((row:any)=>({...row,league:'MLB'})),...(Array.isArray(snapshot?.internationalGames)?snapshot.internationalGames:[])].filter(row=>row&&Object.hasOwn(registered,row.league));
 const names=new Map<string,{sport:string;name:string}>();
 for(const row of rows)for(const side of ['home','away']){
  if(typeof row[side]!=='string')continue;
  const name=row[side].slice(0,100),canonical=row.league==='MLB'?mlbTeamName(mlbSourceTeam(name).name):internationalTeam(name,row.league);
  if(!registered[row.league].has(canonical))names.set(row.league+':'+name,{sport:row.league,name});
 }
 return {revision:'baseball-team-names-v1',fetchedAt:typeof snapshot?.fetchedAt==='string'?snapshot.fetchedAt.slice(0,40):'',fixtureCount:rows.length,unrecognizedTeamNameCount:names.size,unrecognizedTeamNamesTruncated:names.size>120,unrecognizedTeamNames:[...names.values()].slice(0,120)};
}
