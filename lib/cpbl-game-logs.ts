import type {PregameData} from './international-pregame';
import {profileTeams,profileCode} from './international-profile';

export type LogPitcher={id:string;name:string;order:number;outs:number;runs:number;earnedRuns:number;hits:number;walks:number;strikeouts:number;pitches:number|null};
export type CpblGameLog={key:string;id:string;season:number;date:string;start:string;away:string;home:string;awayScore:number;homeScore:number;url:string;pitching?:{away:LogPitcher[];home:LogPitcher[]};observedAt?:string;warnings?:string[];detailCheckedAt?:string;detailError?:string};
export type CpblLogSnapshot={schemaVersion:number;league:string;season:number;observedAt:string;checkedAt:string;sources:{name:string;url:string;observedAt:string}[];games:CpblGameLog[];errors:string[]};
export type LogPitchingTotals={games:number;outs:number;runs:number;earnedRuns:number;hits:number;walks:number;strikeouts:number;era:number;whip:number};
type LogStarter=LogPitchingTotals&{id:string;name:string;starts:{date:string;outs:number}[]};
export type CpblLogMetrics={observedAt:string;throughDate:string;games:number;coveredGames:number;sourceUrl:string;starter:LogStarter|null;recentStarter:LogStarter|null;recentWindow:number;bullpen:LogPitchingTotals|null;bullpenScope:'season'|'last10'|'last5'|'unavailable';recentRelief:{date:string;outs:number;appearances:number;pitches:number|null}[];notes:string[]};
const fields=['outs','runs','earnedRuns','hits','walks','strikeouts'] as const;
const nameKey=(s:string)=>s.replace(/[\s・．·]/g,'');
const dayMs=86400000;
function eligible(snapshot:CpblLogSnapshot,date:string,now:number){
 if(snapshot.league!=='CPBL'||snapshot.season!==Number(date.slice(0,4))||!Number.isFinite(Date.parse(snapshot.observedAt))||Date.parse(snapshot.observedAt)>now||now-Date.parse(snapshot.observedAt)>36*3600000)return [];
 const unique=new Map<string,CpblGameLog>();
 for(const g of snapshot.games){
  if(g.season!==snapshot.season||g.date>=date)continue;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(g.date)||!profileTeams.CPBL[g.away]||!profileTeams.CPBL[g.home]||g.away===g.home||![g.awayScore,g.homeScore].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=100))return [];
  const old=unique.get(g.key);
  if(old&&JSON.stringify(old)!==JSON.stringify(g))return [];
  unique.set(g.key,g);
 }
 return [...unique.values()].sort((a,b)=>a.start.localeCompare(b.start)||a.key.localeCompare(b.key));
}
function pitchingValid(g:CpblGameLog,now:number){
 if(!g.pitching||!g.observedAt||!Number.isFinite(Date.parse(g.observedAt))||Date.parse(g.observedAt)>now)return false;
 return (['away','home'] as const).every(side=>{
  const rows=g.pitching![side],opponent=side==='away'?'home':'away';
  return rows.length>0&&new Set(rows.map(r=>r.id)).size===rows.length&&rows.every((p,i)=>p.order===i+1&&p.name&&/^cpbl\.p\.\d+$/.test(p.id)&&fields.every(f=>Number.isSafeInteger(p[f])&&p[f]>=0)&&p.earnedRuns<=p.runs&&p.outs<=36)&&rows.reduce((n,p)=>n+p.outs,0)>=15&&rows.reduce((n,p)=>n+p.outs,0)<=36&&rows.reduce((n,p)=>n+p.runs,0)===g[opponent+'Score' as 'awayScore'|'homeScore'];
 });
}
function total(rows:LogPitcher[],games:number):LogPitchingTotals|null{
 const sum=Object.fromEntries(fields.map(f=>[f,rows.reduce((n,p)=>n+p[f],0)])) as Record<typeof fields[number],number>;
 return sum.outs>0?{...sum,games,era:sum.earnedRuns*27/sum.outs,whip:(sum.hits+sum.walks)*3/sum.outs}:null;
}
export function cpblLogMetrics(snapshot:CpblLogSnapshot,date:string,code:string,pitcherName='',now=Date.now()):CpblLogMetrics|null{
 const all=eligible(snapshot,date,now),games=all.filter(g=>g.away===code||g.home===code);
 if(!games.length)return null;
 const covered=games.filter(g=>pitchingValid(g,now)),complete=covered.length===games.length;
 const rows=(g:CpblGameLog)=>g.pitching![g.home===code?'home':'away'];
 const names=covered.flatMap(g=>rows(g).filter(p=>nameKey(p.name)===nameKey(pitcherName))),ids=new Set(names.map(p=>p.id));
 const pitcher=(sample:CpblGameLog[]):LogStarter|null=>{
  if(ids.size!==1||!pitcherName)return null;
  const id=[...ids][0],appearances=sample.flatMap(g=>rows(g).filter(p=>p.id===id)),stats=total(appearances,appearances.length);
  return stats?{...stats,id,name:pitcherName,starts:sample.flatMap(g=>rows(g).filter(p=>p.id===id&&p.order===1).map(p=>({date:g.date,outs:p.outs})))}:null;
 };
 const recentWindow=[10,5].find(n=>games.length>=n&&games.slice(-n).every(g=>pitchingValid(g,now)))||0;
 const recent=recentWindow?games.slice(-recentWindow):[];
 const starter=complete?pitcher(covered):null,recentStarter=complete?null:pitcher(recent);
 const sample=complete?covered:recent;
 const bullpen=sample.length>=5?total(sample.flatMap(g=>rows(g).filter(p=>p.order>1)),sample.length):null;
 const latest=covered.map(g=>g.observedAt!).concat(snapshot.observedAt).sort().at(-1)!;
 const from=Date.parse(date+'T00:00:00+08:00')-3*dayMs;
 const recentRelief=covered.filter(g=>Date.parse(g.date+'T00:00:00+08:00')>=from).map(g=>{
  const people=rows(g).filter(p=>p.order>1);return {date:g.date,outs:people.reduce((n,p)=>n+p.outs,0),appearances:people.length,pitches:people.every(p=>p.pitches!==null)?people.reduce((n,p)=>n+p.pitches!,0):null};
 });
 const notes=[];
 if(!complete)notes.push(`本季 ${games.length} 場中有 ${games.length-covered.length} 場投手明細待補，不用部分紀錄冒充完整先發球季成績。`);
 if(!bullpen)notes.push('完整牛棚逐場樣本不足，後援階段仍使用團隊失分估值。');
 if(covered.some(g=>g.warnings?.length))notes.push('部分逐局比分加總不符；採已對上終場比分與安打的投手表，不由逐局比分猜責失。');
 if(recentRelief.some(g=>g.pitches===null))notes.push('來源未提供完整投球數；近期後援用量只列可核對局數與登板人次。');
 if(recentStarter)notes.push(`先發近期樣本來自球隊最近 ${recentWindow} 場中的 ${recentStarter.games} 次登板；僅在完整球季成績不可用時作收縮估計，不作本季成績展示。`);
 return {observedAt:latest,throughDate:games.at(-1)!.date,games:games.length,coveredGames:covered.length,sourceUrl:snapshot.sources[0]?.url||'',starter,recentStarter,recentWindow,bullpen,bullpenScope:bullpen?(complete?'season':recentWindow===10?'last10':'last5'):'unavailable',recentRelief,notes};
}
export function supplementCpblGameLogs(data:PregameData,snapshot:CpblLogSnapshot,now=Date.now()):PregameData{
 if(data.league!=='CPBL'||data.season!==snapshot.season)return data;
 const all=eligible(snapshot,data.date,now);if(!all.length)return data;
 return {...data,games:data.games.map(g=>{
  if(g.league!=='CPBL'||g.date!==data.date)return g;
  if(g.comparisonSource&&Date.parse(g.comparisonSource.observedAt)>Date.parse(snapshot.observedAt))return g;
  const result={...g},comparison=[];
  for(const side of ['away','home'] as const){
   const code=profileCode('CPBL',g[side].team),team=code&&profileTeams.CPBL[code];if(!code||team!==g[side].team)return g;
   const metrics=cpblLogMetrics(snapshot,g.date,code,g[side].starter.name,now);if(!metrics)return g;
   const games=all.filter(x=>x.home===code||x.away===code);
   const summarize=(selected:CpblGameLog[])=>{
    let w=0,l=0,t=0,rf=0,ra=0;
    for(const x of selected){const a=x.home===code?x.homeScore:x.awayScore,b=x.home===code?x.awayScore:x.homeScore;rf+=a;ra+=b;if(a>b)w++;else if(a<b)l++;else t++;}
    return {record:`${w}-${l}-${t}`,rate:selected.length?`${(rf/selected.length).toFixed(6)} / ${(ra/selected.length).toFixed(6)}`:''};
   };
   const season=summarize(games),home=summarize(games.filter(x=>x.home===code)),away=summarize(games.filter(x=>x.away===code));
   comparison.push([team,'本季',season.record,season.rate,home.record,home.rate,away.record,away.rate]);
   result[side]={...g[side],gameLogs:metrics};
  }
  result.comparison={title:'中職逐場比賽日誌彙算',headers:['球隊','類別','勝敗','得/失分','主場勝率','主場得/失分','客場勝率','客場得/失分'],rows:comparison};
  result.comparisonSource={name:'Yahoo 中職逐場完賽紀錄',url:snapshot.sources[0]?.url||'',observedAt:snapshot.observedAt,throughDate:all.at(-1)!.date,games:all.length};
  return result;
 })};
}
export function cpblLogCoverage(snapshot:CpblLogSnapshot,date:string,now=Date.now()){
 return {season:snapshot.season,observedAt:snapshot.observedAt,checkedAt:snapshot.checkedAt,sourceUrl:snapshot.sources[0]?.url,errors:snapshot.errors,teams:Object.entries(profileTeams.CPBL).map(([code,team])=>({team,metrics:cpblLogMetrics(snapshot,date,code,'',now)}))};
}
