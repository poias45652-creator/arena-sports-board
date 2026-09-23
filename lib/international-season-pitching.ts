import {internationalTeam} from './international-teams';
import {pitcherIdentity} from './international-pitcher-identity';
import type {PregameData} from './international-pregame';
import {internationalFixtureTime} from './international-fixture-time';
/** Replace only a named pitcher's verified season row. Never borrow another pitcher or bullpen. */
export function supplementSeasonPitching(data:PregameData,result:any,now=Date.now()):PregameData{
 if(!['NPB','KBO'].includes(data.league))return data;
 return {...data,games:data.games.map(g=>{
  const start=internationalFixtureTime(g.start);if(g.date!==data.date||g.league!==data.league||!Number.isFinite(start)||start<=now)return g;
  const out={...g};
  for(const side of ['away','home'] as const){
   const old=g[side],name=old.starter.name;if(!name)continue;
   const matches=(result?.rows||[]).filter((r:any)=>internationalTeam(r.team,data.league)===internationalTeam(old.team,data.league)&&pitcherIdentity(r.name,data.league,r.team)===pitcherIdentity(name,data.league,old.team));
   if(matches.length!==1)continue;const row=matches[0],observed=Date.parse(row.source?.observedAt);
   if(!Number.isFinite(observed)||observed>now||observed>=start||now-observed>36*3600000)continue;
   // A newer probable-starter ERA must not block missing WHIP/IP from the
   // same verified pitcher. Reject conflicting newer figures as a whole.
   const newer=(field:string)=>Date.parse((old.starter.statSources as any)?.[field]?.observedAt||'')>observed;
   if(['era','whip','innings'].some(field=>newer(field)&&String((old.starter.season as any)[field]??'')!==''&&row.stats[field]!==''&&Number.isFinite(Number((old.starter.season as any)[field]))&&Math.abs(Number((old.starter.season as any)[field])-Number(row.stats[field]))>.025))continue;
   const source={name:row.source.name,url:row.source.url,observedAt:row.source.observedAt,publishedAt:row.source.publishedAt||null};
   const values=Object.entries(row.stats).filter(([field,value])=>value!==''&&value!==null&&value!==undefined&&(!newer(field)||!(old.starter.season as any)[field]));
   const season={...old.starter.season,...Object.fromEntries(values)};
   out[side]={...old,starter:{...old.starter,season,quality:'source_reported',statSources:{...old.starter.statSources,...Object.fromEntries(values.map(([field])=>[field,source]))},warnings:[...new Set([...old.starter.warnings,...(row.notes||[])])],...(old.starter.quality==='needs_review'?{review:{reviewedAt:source.observedAt,note:'投手姓名與球隊已配對；本季成績改採官方逐欄核對值。',sources:[source]}}:{})}};
  }
  return out;
 })};
}
