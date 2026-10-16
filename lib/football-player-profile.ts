import {footballTeamName,type FootballLeague} from './football';
import {footballTeamHref,footballCompetitionName} from './football-team-profile';
import {footballProfileDefaultSeason} from './football-team-details';
import {footballRosterPhotoCorrection,matchesFootballRosterCorrection} from './football-roster-photo-corrections';
import {playerSource,espnPagePlayer} from './sport-player-fetch';
import {FOOTBALL_LABELS,namedValues,playerCountry,playerPosition,playerNameKey,type SportPlayerData,type PlayerRow,type PlayerColumn} from './sport-player-profile';
const filter=(p:any,key:string)=>String(p?.find((f:any)=>f.fld===key)?.val||'');
export function footballPlayerHistory(p:any,id:string,league:string,team:string){
 if(String(p?.playerId)!==id||filter(p.stat?.ftr,'type')!==league||team&&filter(p.stat?.ftr,'team')!==team)throw Error('球員成績身分或賽事不符');
 if(!Array.isArray(p.stat?.tbl))throw Error('歷年成績尚未提供');
 const columns:PlayerColumn[]=[],rows:PlayerRow[]=[];
 for(const table of p.stat.tbl){const keys=table.col?.slice(2).map((c:any)=>String(c.data||''));if(!keys)continue;
  for(const key of keys)if(FOOTBALL_LABELS[key]&&!columns.some(c=>c[0]===key))columns.push([key,FOOTBALL_LABELS[key]]);
  for(const row of table.row||[]){const year=Number(String(row[0]).match(/^\d{4}/)?.[0]);if(!year)continue;const teamId=String(row[1]?.uid||'').split('~t:')[1];const teamOption=p.stat.ftr.find((f:any)=>f.fld==='team')?.itm?.find((t:any)=>String(t.id)===teamId);const name=footballTeamName(teamOption?.ttl||row[1]?.name||'');const label=String(row[0]).match(/^\d{4}(?:-\d{2})?/)?.[0]||String(year);const existing=rows.find(r=>r.season===year&&r.team===name);const values=namedValues(keys,row.slice(2));if(existing)Object.assign(existing.values,values);else rows.push({season:year,label,team:name,competition:footballCompetitionName(league),values});}
 }
 return {columns,rows:rows.sort((a,b)=>b.season!-a.season!)};
}
export function footballPlayerGames(p:any,id:string,league:string,team:string,season:number){
 const log=p?.gmlog;if(String(p?.playerId)!==id||filter(log?.ftr,'type')!==league||Number(filter(log?.ftr,'year'))!==season||team&&filter(log?.ftr,'team')!==team)throw Error('逐場紀錄身分、年度或賽事不符');
 if(!Array.isArray(log.groups)||!Array.isArray(log.labels))throw Error('逐場紀錄尚未提供');
 const keys=log.labels.map((c:any)=>String(c.data||'')),columns:PlayerColumn[]=keys.filter((k:string)=>FOOTBALL_LABELS[k]).map((k:string)=>[k,FOOTBALL_LABELS[k]]),seen=new Set<string>(),rows:PlayerRow[]=[];
 for(const g of log.groups)for(const table of g.tbls||[])for(const e of table.events||[]){if(!/^\d+$/.test(String(e.id))||seen.has(String(e.id))||!Number.isFinite(Date.parse(e.dt))||!['W','L','D','T'].includes(e.res?.abbr))continue;seen.add(String(e.id));rows.push({season,label:footballTeamName(e.opp?.name||''),date:e.dt,competition:footballCompetitionName(league),result:({W:'勝',L:'負',D:'和',T:'和'} as Record<string,string>)[e.res.abbr]+' '+String(e.res.score||''),values:namedValues(keys,e.stats)});}
 return {columns,rows:rows.sort((a,b)=>Date.parse(b.date!)-Date.parse(a.date!))};
}
export async function footballPlayerProfile(id:string,league:FootballLeague,requestedSeason?:number,teamContext=''):Promise<SportPlayerData>{
 const season=requestedSeason||footballProfileDefaultSeason(league),root=`https://www.espn.com/soccer/player`,bioRaw=await playerSource(`https://site.web.api.espn.com/apis/common/v3/sports/soccer/${league}/athletes/${id}`),p=bioRaw.athlete;
 if(String(p?.id)!==id||!p.displayName)throw Error('找不到這位球員');
 const team=teamContext||String(p.team?.id||''),reviewed=footballRosterPhotoCorrection(id,league,team,season),correction=reviewed&&matchesFootballRosterCorrection(p,reviewed)?reviewed:undefined,identity=correction?.identity;
 if(correction?.exclude)throw Error('此來源球員身分仍待核對');
 const identityMismatch=!!identity&&playerNameKey(identity.name)!==playerNameKey(p.displayName);
 const urls=[`${root}/stats/_/id/${id}/type/${league}${team?'/team/'+team:''}`,`${root}/matches/_/id/${id}/type/${league}${team?'/team/'+team:''}/year/${season}`];
 const warnings:string[]=[],history:PlayerRow[]=[],games:PlayerRow[]=[];let columns:PlayerColumn[]=[],gameColumns:PlayerColumn[]=[];
 if(identityMismatch)warnings.push('此球員已核對個人身分，來源成績仍待完成身分同步。');
 else{const results=await Promise.allSettled(urls.map(async u=>espnPagePlayer(await playerSource(u,true),id)));for(let i=0;i<results.length;i++){const result=results[i];try{if(result.status==='rejected')throw result.reason;const parsed=i===0?footballPlayerHistory(result.value,id,league,team):footballPlayerGames(result.value,id,league,team,season);if(i===0){columns=parsed.columns;history.push(...parsed.rows);}else{gameColumns=parsed.columns;games.push(...parsed.rows);}}catch{warnings.push(i===0?'歷年成績暫時無法取得。':'逐場紀錄暫時無法取得。');}}}
 const selected=history.find(r=>r.season===season),name=identity?.name||p.displayName;
 return {id,sport:'football',league,name,photo:`/api/football-player-photo?player=${id}&league=${league}&team=${team}&season=${season}`,number:String(p.jersey||''),position:playerPosition(identity?.position||p.position?.displayName||p.position?.abbreviation||''),team:p.team?.id?{name:footballTeamName(p.team.displayName),href:footballTeamHref(league,String(p.team.id))}:null,
 bio:[['出生日期',identity?.birthDate||String(p.dateOfBirth||'').slice(0,10)||'—'],['國籍',playerCountry(identity?.country||p.citizenship)],['身高',identity?.height||p.displayHeight||'—'],['體重',!identityMismatch&&p.displayWeight?String(p.displayWeight).replace('lbs','磅'):'—']],season,phase:'2',seasons:[...new Set([season,...history.map(r=>r.season!)])].sort((a,b)=>b-a),summary:selected?.values||{},summaryLabel:`${selected?.label||season} · ${footballCompetitionName(league)}${selected?.team?' · '+selected.team:''}`,columns,gameColumns,history,games,warnings,sources:correction?.identity?[{label:'球員身分核對來源',url:correction.source}]:[{label:'ESPN 球員資料',url:urls[0]}],fetchedAt:new Date().toISOString()};
}
