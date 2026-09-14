// MLB regular-season pitching rates, keyed by the exact probable-pitcher ID.
export type PitcherRates={era:number|null;whip:number|null};
function rate(value:unknown):number|null{
  if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+(?:\.\d+)?$/.test(value.trim())))return null;
  const parsed=Number(value);
  return Number.isFinite(parsed)&&parsed>=0?parsed:null;
}
export function parsePitcherRates(data:any,season:number):Record<number,PitcherRates>{
  const result:Record<number,PitcherRates>={};
  for(const person of Array.isArray(data?.people)?data.people:[]){
    if(!Number.isInteger(person.id)||person.id<=0)continue;
    const rows=(Array.isArray(person.stats)?person.stats:[])
      .filter((s:any)=>s.group?.displayName==='pitching'&&s.type?.displayName==='season')
      .flatMap((s:any)=>Array.isArray(s.splits)?s.splits:[])
      .filter((s:any)=>Number(s.season)===season&&s.sport?.id===1&&s.gameType==='R'&&s.player?.id===person.id);
    const totals=rows.filter((r:any)=>!r.team?.id);
    // Prefer the all-team total for a traded player; never average team ERAs.
    const row=totals.length===1?totals[0]:rows.length===1?rows[0]:null;
    result[person.id]={era:rate(row?.stat?.era),whip:rate(row?.stat?.whip)};
  }
  return result;
}
export function parsePitcherEras(data:any,season:number):Record<number,number|null>{
  return Object.fromEntries(Object.entries(parsePitcherRates(data,season)).map(([id,rates])=>[id,rates.era]));
}
