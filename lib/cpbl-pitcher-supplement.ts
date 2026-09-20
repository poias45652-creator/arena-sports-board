import type {PregameData, PregamePitchingStats} from './international-pregame';

type StatSource={name:string;url:string;observedAt:string;publishedAt:string|null};
export type CpblPitcherSupplement={league:string;season:number;pitchers:{team:string;teamCode:string;name:string;season:PregamePitchingStats;source:StatSource;hits:number;earnedRuns:number}[]};
const fields=['wins','losses','era','innings','strikeouts','walks','whip'] as const;
const numeric=(v:unknown)=>typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v);
const normalize=(v:string)=>v.replace(/[\s・·]/g,'');
function outs(value:string){const m=value.match(/^(\d+)(?:\.([012]))?$/);return m?Number(m[1])*3+Number(m[2]||0):null;}

// Reuse the already-saved season rows; this module performs no network requests.
// Fill only absent fields for the exact team AND pitcher, preserving every
// existing value and review flag. A daily archive never becomes a fresh live row.
export function supplementCpblPitchers(data:PregameData,archive:CpblPitcherSupplement,now=Date.now()):PregameData{
 if(data.league!=='CPBL'||archive.league!=='CPBL'||data.season!==archive.season)return data;
 return {...data,games:data.games.map(game=>{
  if(game.league!=='CPBL'||game.date!==data.date||!game.start.startsWith(game.date+' '))return game;
  const start=Date.parse(game.start.replace(' ','T')+'+08:00');
  const result={...game};
  for(const side of ['away','home'] as const){
   const team=game[side],starter=team.starter;
   if(!starter.name||starter.quality==='needs_review')continue;
   const matches=archive.pitchers.filter(p=>p.team===team.team&&p.teamCode===team.teamCode&&normalize(p.name)===normalize(starter.name));
   if(matches.length!==1)continue;
   const row=matches[0],observed=Date.parse(row.source.observedAt),innings=outs(row.season.innings);
   if(!Number.isFinite(start)||!Number.isFinite(observed)||observed>now||observed>=start||start-observed>36*3600000||new Date(observed).getUTCFullYear()!==archive.season)continue;
   if(!innings||!fields.every(f=>numeric(row.season[f]))||!Number.isInteger(row.hits)||!Number.isInteger(row.earnedRuns)||row.hits<0||row.earnedRuns<0)continue;
   if(Math.abs(Number(row.season.era)-row.earnedRuns*27/innings)>.011||Math.abs(Number(row.season.whip)-(row.hits+Number(row.season.walks))*3/innings)>.011)continue;
   const added=fields.filter(f=>!starter.season[f]||['—','-'].includes(starter.season[f]));
   if(!added.length)continue;
   const season={...starter.season},statSources={...starter.statSources};
   for(const field of added){season[field]=row.season[field];statSources[field]=row.source;}
   result[side]={...team,starter:{...starter,season,statSources,quality:'source_reported',warnings:starter.warnings.filter(w=>!w.includes('投手成績與臨時異動')&&!w.includes('來源尚未公布先發投手'))}};
  }
  return result;
 })};
}
