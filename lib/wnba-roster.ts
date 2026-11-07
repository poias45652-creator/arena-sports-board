import {officialBasketballSeason,playerSeasonResult,noRegularAppearance} from './basketball-season-totals';
import {officialWnbaRoster} from './wnba-official';
import {enrichWnbaPlayer,wnbaOfficialPlayers} from './wnba-official-players';
import {wnbaTeam} from './wnba';
type EspnRoster = ReturnType<typeof parseWnbaRoster>;
type EnrichedPlayer = ReturnType<typeof enrichWnbaPlayer<EspnRoster['roster'][number]>>;
type EnrichedRoster = Omit<EspnRoster,'roster'> & {roster:EnrichedPlayer[]};
const cache=new Map<string,{value:EnrichedRoster;until:number}>(),pending=new Map<string,Promise<EnrichedRoster>>();
export function parseWnbaRoster(raw:any,id:string){
 const team=wnbaTeam(id);if(!team||String(raw?.team?.id)!==id||!Array.isArray(raw.athletes)||!Number.isInteger(raw.season?.year))throw Error('WNBA 球員名單不符');
 const roster=(raw.athletes as any[]).map((p:any)=>{if(!/^\d{1,10}$/.test(String(p.id))||!/^s:40~l:59~a:\d+$/.test(p.uid)||!p.displayName)throw Error('WNBA 球員資料不符');return {id:Number(p.id),name:String(p.displayName),number:String(p.jersey||''),position:String(p.position?.abbreviation||''),height:String(p.displayHeight||''),weight:typeof p.weight==='number'?String(p.weight):'',experience:String(p.experience?.years??''),school:String(p.college?.name||''),season:String(raw.season.year),slug:'',photo:`https://a.espncdn.com/i/headshots/wnba/players/full/${p.id}.png`,href:`https://www.espn.com/wnba/player/stats/_/id/${p.id}`};});
 const coach=raw.coach?.[0];
 return {team,season:String(raw.season.year),rosterSeason:String(raw.season.year),roster,background:{coach:coach?[coach.firstName,coach.lastName].filter(Boolean).join(' '):''},recordSummary:String(raw.team.recordSummary||''),sourceLabel:'WNBA',sourceUrl:`https://www.espn.com/wnba/team/_/name/${team.code.toLowerCase()}`};
}
async function espnWnbaRoster(id:string){
 if(!wnbaTeam(id))throw Error('球隊不存在');const hit=cache.get(id);if(hit&&hit.until>Date.now())return hit.value;if(pending.has(id))return pending.get(id)!;
 const task=(async()=>{const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/${id}/roster`,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('WNBA 球員資料更新失敗');const text=await r.text();if(text.length>3000000)throw Error('WNBA 球員資料過大');const raw=parseWnbaRoster(JSON.parse(text),id);const official=await wnbaOfficialPlayers().catch(()=>[]);const value={...raw,roster:raw.roster.map((p:ReturnType<typeof parseWnbaRoster>['roster'][number])=>enrichWnbaPlayer(p,id,Number(raw.season),official))};cache.set(id,{value,until:Date.now()+15*60000});return value;})().finally(()=>pending.delete(id));pending.set(id,task);return task;
}

export async function wnbaRoster(id:string){
 if(!wnbaTeam(id))throw Error('球隊不存在');
 const team=await officialWnbaRoster(id).catch(()=>espnWnbaRoster(id));
 const year=Number(team.rosterSeason),totals=await officialBasketballSeason('WNBA',year);
 return {...team,roster:team.roster.map(player=>{
  const officialId=player.href.startsWith('https://www.wnba.com/player/')?Number(player.href.split('/')[4]):undefined;
  const {line,missing}=playerSeasonResult(totals,officialId);
  const averages=line?{season:year,points:line.points,rebounds:line.rebounds,assists:line.assists}:player.averages;
  return {...player,averages,statsNote:!averages&&missing?noRegularAppearance:undefined};
 })};
}
