import {fetchPublic,yahooObjects,inningsToOuts,integerOrNull,dayInTaipei} from './baseball-live-providers.mjs';

const teams={'cpbl.t.1':'ACN','cpbl.t.2':'ADD','cpbl.t.5':'AEO','cpbl.t.6':'AJL','cpbl.t.7':'AAA','cpbl.t.8':'AKP'};
const names=['中信','統一','富邦','樂天','味全','台鋼'];
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const allowed=url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='tw.sports.yahoo.com'&&/^\/cpbl\/[^/]+-\d{9}\/$/.test(u.pathname);}catch{return false;}};
const identity=g=>JSON.stringify([g.id,g.date,g.start,g.away,g.home,g.awayScore,g.homeScore]);

export function cpblLogSchedule(pages,season){
 assert(pages.length===6,'六隊逐場賽程未齊');
 const games=new Map();
 for(const page of pages){
  let count=0;
  for(const raw of yahooObjects(page.text)){
   if(raw.seasonPhase!=='REGULAR_SEASON'||raw.status!=='FINAL'||!raw.startTime?.startsWith(season+'-'))continue;
   if(!/^cpbl\.g\.\d{9}$/.test(raw.gameId)||!teams[raw.homeTeamId]||!teams[raw.awayTeamId])continue;
   const date=dayInTaipei(new Date(raw.startTime)),id=raw.gameId.slice(7),awayScore=integerOrNull(raw.awayScore),homeScore=integerOrNull(raw.homeScore);
   assert(id.slice(0,6)===date.replaceAll('-','').slice(2)&&awayScore!==null&&homeScore!==null&&allowed(raw.alias?.url),'逐場日期／比分／來源不符');
   const row={key:`CPBL:${season}:${Number(id.slice(-3))}`,id,season,date,start:new Date(raw.startTime).toISOString(),away:teams[raw.awayTeamId],home:teams[raw.homeTeamId],awayScore,homeScore,url:raw.alias.url};
   const old=games.get(row.key);assert(!old||identity(old)===identity(row),'同場完賽紀錄衝突：'+row.key);games.set(row.key,row);count++;
  }
  assert(count>0,'球隊逐場賽程沒有可核對的完賽紀錄');
 }
 return [...games.values()].sort((a,b)=>a.start.localeCompare(b.start)||a.key.localeCompare(b.key));
}

export function cpblPitchingLog(page,fixture){
 const choices=yahooObjects(page.text).filter(x=>x.gameId==='cpbl.g.'+fixture.id&&x.playerStats);
 assert(choices.length===1,'逐場完整投手資料缺漏／重複');
 const raw=choices[0];
 assert(raw.seasonPhase==='REGULAR_SEASON'&&raw.status==='FINAL'&&raw.season===fixture.season,'不是本季例行賽完賽紀錄');
 assert(teams[raw.homeTeamId]===fixture.home&&teams[raw.awayTeamId]===fixture.away&&new Date(raw.startTime).toISOString()===fixture.start&&Number(raw.homeScore)===fixture.homeScore&&Number(raw.awayScore)===fixture.awayScore,'賽程與逐場資料不一致');
 const pitching={},warnings=[];
 for(const side of ['away','home']){
  const opponent=side==='away'?'home':'away',tables=raw.playerStats[side+'Tables'].filter(t=>t.tableId==='pitching');
  assert(tables.length===1&&tables[0].tableStats.length,'投手表缺漏');
  const lineup=(raw[side+'TeamLineup']||[]).filter(p=>p.positionId==='PITCHER');
  const rows=tables[0].tableStats.map(r=>{
   const p=r.player,stats=Object.fromEntries(r.stats.map(s=>[s.statId,s.value]));
   const row={id:p.playerId,name:p.displayName,order:integerOrNull(p.order),outs:inningsToOuts(stats.INNINGS_PITCHED),runs:integerOrNull(stats.RUNS_ALLOWED),earnedRuns:integerOrNull(stats.EARNED_RUNS),hits:integerOrNull(stats.HITS_ALLOWED),walks:integerOrNull(stats.WALKS_ALLOWED),strikeouts:integerOrNull(stats.STRIKEOUTS_THROWN),pitches:integerOrNull(stats.PITCHES_THROWN)};
   assert(/^cpbl\.p\.\d+$/.test(row.id)&&row.name&&row.order>0&&p.subOrder===1,'投手身分或登板順序缺漏');
   assert(['outs','runs','earnedRuns','hits','walks','strikeouts'].every(k=>Number.isSafeInteger(row[k])&&row[k]>=0)&&row.outs<=36&&row.earnedRuns<=row.runs,'投手數字缺漏或無效');
   assert(lineup.some(x=>x.player?.playerId===row.id&&x.order===row.order),'投手表與出賽名單順序不符');
   return row;
  }).sort((a,b)=>a.order-b.order);
  assert(new Set(rows.map(p=>p.id)).size===rows.length&&rows.every((p,i)=>p.order===i+1),'投手重複／登板順序不連續');
  const sum=k=>rows.reduce((n,p)=>n+p[k],0),outs=sum('outs');
  assert(outs>=15&&outs<=36&&sum('runs')===fixture[opponent+'Score']&&sum('hits')===integerOrNull(raw[opponent+'Hits']),'投手加總與終場比分／安打不符');
  const innings=raw[opponent+'LineScore']||[],runs=innings.map(x=>integerOrNull(x.score));
  if(runs.some(n=>n===null)||runs.reduce((a,b)=>a+b,0)!==fixture[opponent+'Score'])warnings.push(side+'：逐局比分加總不符，未用逐局比分反推責失');
  // Yahoo marks all pitching rows isStarter=true. Use explicit pitching order
  // cross-checked against its PITCHER lineup, never that boolean or array position.
  pitching[side]=rows;
 }
 return {...fixture,pitching,observedAt:page.fetchedAt,warnings};
}

export async function collectCpblGameLogs({season,previous=/** @type {import('../lib/cpbl-game-logs').CpblLogSnapshot|null} */(null),fetcher=fetch,maxDetails=6,pages=null,onProgress=()=>{}}){
 const schedulePages=pages||await Promise.all(names.map(name=>fetchPublic('https://tw.sports.yahoo.com/cpbl/teams/'+encodeURIComponent(name)+'/',fetcher)));
 const schedule=cpblLogSchedule(schedulePages,season),observedAt=schedulePages.map(p=>p.fetchedAt).sort()[0];
 const old=new Map((previous?.games||[]).filter(g=>g.season===season).map(g=>[g.key,g]));
 const games=schedule.map(g=>{const p=old.get(g.key);return p&&identity(p)===identity(g)?{...g,...(p.pitching?{pitching:p.pitching,observedAt:p.observedAt,warnings:p.warnings||[]}:{}),...(p.detailCheckedAt?{detailCheckedAt:p.detailCheckedAt,detailError:p.detailError}:{})}:g;});
 const now=Date.now(),cutoff=dayInTaipei(new Date(now-3*86400000));
 const needed=games.filter(g=>(!g.pitching||g.date>=cutoff&&now-Date.parse(g.observedAt)>3600000)&&(!g.detailError||!g.detailCheckedAt||now-Date.parse(g.detailCheckedAt)>6*3600000)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,maxDetails);
 let cursor=0,done=0;
 await Promise.all(Array.from({length:Math.min(3,needed.length)},async()=>{while(cursor<needed.length){const item=needed[cursor++];try{const page=await fetchPublic(item.url,fetcher);Object.assign(item,cpblPitchingLog(page,item));delete item.detailError;}catch(e){item.detailError=e.message;}item.detailCheckedAt=new Date().toISOString();onProgress(++done,needed.length);}}));
 return {schemaVersion:1,league:'CPBL',season,observedAt,checkedAt:new Date().toISOString(),sources:schedulePages.map(p=>({name:'Yahoo 中職逐場賽程',url:p.url,observedAt:p.fetchedAt})),games,errors:games.filter(g=>g.detailError).map(g=>g.key+': '+g.detailError)};
}
