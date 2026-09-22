// Finite, unauthenticated public-source diagnostics. Never read account data or secrets.
import {collectLeague,dayInTaipei} from '../server/baseball-current.mjs';
import {plain,tableData,yahooObjects} from '../server/baseball-live-providers.mjs';
const league=process.argv[2],date=dayInTaipei();
if(!['CPBL','NPB','KBO'].includes(league))throw Error('Unknown league');
const read=async url=>{const r=await fetch(url,{redirect:'manual',headers:{'User-Agent':'YJBaseballSourceCheck/1.0',Accept:'text/html,application/json'},signal:AbortSignal.timeout(10000)});if(!r.ok){await r.body?.cancel();throw Error(`HTTP ${r.status}`);}let bytes=0,parts=[];for await(const part of r.body){bytes+=part.byteLength;if(bytes>8000000)throw Error('Oversize public page');parts.push(part);}return Buffer.concat(parts).toString('utf8');};
try{
 const feed=await collectLeague(league,{date});
 console.log('CURRENT_FEED',JSON.stringify({environment:'GitHub Actions, not Render',league,date,observedAt:new Date().toISOString(),errors:feed.errors,games:feed.games.map(g=>({id:g.id,startTime:g.startTime,status:g.status,rawStatus:g.rawStatus,teams:[g.away.name,g.home.name],starters:[g.starters?.away?.name||null,g.starters?.home?.name||null],lineups:[g.lineups.away.length,g.lineups.home.length],pitchers:[g.pitching.away.length,g.pitching.home.length],bso:[g.balls,g.strikes,g.outs],bases:g.bases,url:g.source.url}))}));
 const sample=feed.games[0];
 if(league==='NPB'&&sample){
  const html=await read(sample.source.url);
  console.log('NPB_CLOCK_MARKUP',JSON.stringify([...html.matchAll(/.{0,160}(?:bb-gameRound|bb-gameCard__time|start_time|開始|試合時間|["']startDate["']).{0,220}/g)].map(x=>x[0]).slice(0,18)));
  const tomorrow=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  const next=await collectLeague(league,{date:tomorrow});console.log('NPB_NEXT_DAY',JSON.stringify(next.games.map(g=>({id:g.id,status:g.status,rawStatus:g.rawStatus,startTime:g.startTime,starters:[g.starters?.away?.name||null,g.starters?.home?.name||null]}))));
 }
 if(league==='CPBL'&&sample){
  const html=await read(sample.source.url),rows=yahooObjects(html).filter(x=>x.gameId===`cpbl.g.${sample.id}`);
  for(const row of rows.slice(0,4))console.log('CPBL_GAME_FIELDS',JSON.stringify({keys:Object.keys(row),probables:Object.fromEntries(Object.entries(row).filter(([k])=>/pitcher|starter|probable/i.test(k))),lineupKeys:['awayTeamLineup','homeTeamLineup'].map(k=>({side:k,first:row[k]?.slice?.(0,2)})),pitcherRows:['awayTables','homeTables'].map(k=>({side:k,tables:(row.playerStats?.[k]||[]).filter(t=>t.tableId==='pitching').map(t=>({headers:Object.keys(t),rows:t.tableStats?.slice?.(0,2)}))}))}));
 }
 if(league==='KBO'){
  if(sample){const raw=JSON.parse(await read(sample.source.url)).result;console.log('KBO_RELAY_SHAPE',JSON.stringify({resultKeys:Object.keys(raw||{}),relayKeys:Object.keys(raw?.textRelayData||{}),gameKeys:Object.keys(raw?.game||{}),publicStarterFields:Object.fromEntries(Object.entries(raw?.game||{}).filter(([k])=>/starter|pitcher/i.test(k)))}));}
  const html=await read('https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx');
  const links=[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].filter(m=>['G','IP','ERA','경기'].includes(plain(m[2]))||/Basic[23]\.aspx/.test(m[1])).map(m=>({text:plain(m[2]),attrs:m[1]}));
  const selects=[...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)].filter(m=>/ddlTeam|ddlSeason|ddlSeries/.test(m[1])).map(m=>({attrs:m[1],selected:plain(m[2].match(/<option[^>]*selected[^>]*>([\s\S]*?)<\/option>/i)?.[1]||'')}));
  console.log('KBO_TABLE_CONTROLS',JSON.stringify({links,selects,headers:tableData(html).map(t=>t.rows[0]).filter(r=>r.includes('ERA')),qualifierText:plain(html).match(/.{0,60}규정.{0,90}/g)}));
 }
}catch(e){console.log('PUBLIC_SOURCE_ERROR',JSON.stringify({league,date,message:e.message}));process.exitCode=1;}
