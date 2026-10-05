import identities from '../data/wnba-player-identities.json';
import snapshot from '../data/wnba-player-strength.json';
import {wnbaNameKey} from './wnba-official-players';
import {wnbaPage} from './wnba-fetch';
import type {PlayerEvidence} from './basketball-player-strength';
const cache=new Map<string,{value:PlayerEvidence[];until:number}>();
export function parseWnbaCurrentRoster(raw:any,team:string,season:number):PlayerEvidence[]{
 if(String(raw?.team?.id)!==team||raw?.season?.year!==season||!Array.isArray(raw.athletes))throw Error('WNBA current roster team or season mismatch');
 const seen=new Set<string>(),officialIds=new Set<number>();
 const verified=new Map(Object.entries(snapshot.players).map(([id,p])=>[p.sourceId,{id:Number(id),name:p.name}]));
 const rows:PlayerEvidence[]=[];
 for(const p of raw.athletes){
  const sourceId=String(p.id);
  if(!/^\d+$/.test(sourceId)||p.uid!==`s:40~l:59~a:${sourceId}`||seen.has(sourceId)||typeof p.displayName!=='string')throw Error('WNBA current roster identity mismatch');seen.add(sourceId);
  const saved=(identities.players as Record<string,{id:number;name:string}>)[sourceId],rated=verified.get(sourceId);
  if(saved&&rated&&(saved.id!==rated.id||wnbaNameKey(saved.name)!==wnbaNameKey(rated.name)))throw Error('WNBA conflicting verified identity');
  const match=rated||saved;if(!match||wnbaNameKey(match.name)!==wnbaNameKey(p.displayName))continue;
  if(officialIds.has(match.id))throw Error('WNBA duplicate official identity');officialIds.add(match.id);
  // This endpoint verifies roster membership, not game availability. Do not
  // infer healthy/active-for-this-game from presence on the team roster.
  rows.push({id:match.id,name:p.displayName,status:'unknown',minutesConfirmed:false,sourceUrl:`https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/${team}/roster`});
 }
 if(rows.length<8)throw Error('WNBA verified current roster incomplete');return rows;
}
async function currentRoster(team:string,season:number){
 const key=`${team}:${season}`,hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.value;
 const raw=JSON.parse(await wnbaPage(`https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/${team}/roster`,7000));
 const value=parseWnbaCurrentRoster(raw,team,season);cache.set(key,{value,until:Date.now()+60000});return value;
}
export async function currentWnbaAnalysisRosters(homeId:string,awayId:string,season:number){
 const [home,away]=await Promise.all([currentRoster(homeId,season),currentRoster(awayId,season)]);return {home,away};
}
