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
   if(Object.values(old.starter.statSources||{}).some(s=>s&&Date.parse(s.observedAt)>observed))continue;
   const source={name:row.source.name,url:row.source.url,observedAt:row.source.observedAt,publishedAt:row.source.publishedAt||null};
   const season={...old.starter.season,...row.stats};
   out[side]={...old,starter:{...old.starter,season,quality:'source_reported',statSources:{...old.starter.statSources,...Object.fromEntries(Object.keys(row.stats).map(field=>[field,source]))},warnings:[...new Set([...old.starter.warnings,...(row.notes||[])])],...(old.starter.quality==='needs_review'?{review:{reviewedAt:source.observedAt,note:'投手姓名與球隊已配對；本季成績改採官方逐欄核對值。',sources:[source]}}:{})}};
  }
  return out;
 })};
}
