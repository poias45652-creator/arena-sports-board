import {collectLeague} from '../server/baseball-current.mjs';
import {fetchPublic,yahooObjects,plain} from '../server/baseball-live-providers.mjs';
const league=process.argv[2],date='2026-09-22';
const output=(label,value,max=22000)=>console.log(label,JSON.stringify(value).slice(0,max));
try{
 const feed=await collectLeague(league,{date});output('FEED',{errors:feed.errors,games:feed.games.map(g=>({id:g.id,away:g.away.name,home:g.home.name,status:g.status,url:g.source.url}))});
 const g=feed.games.find(g=>league==='NPB'?g.away.name==='讀賣巨人':league==='CPBL'?g.away.name==='味全龍':g.away.name==='斗山熊')||feed.games[0];if(!g)process.exit(0);
 const p=await fetchPublic(g.source.url);
 if(league==='CPBL'){
  const objects=yahooObjects(p.text),raw=objects.find(x=>x.gameId==='cpbl.g.'+g.id&&x.playerStats);
  output('CPBL_GAME_KEYS',Object.keys(raw||{}));
  for(const key of Object.keys(raw||{}).filter(k=>/play|event|summary|drive|period|score|comment/i.test(k)))output('CPBL_FIELD_'+key,raw[key],18000);
  const interesting=objects.filter(x=>Object.keys(x).some(k=>/playByPlay|playText|playDescription|commentary/i.test(k)));output('CPBL_EVENT_OBJECTS',interesting.slice(0,3));
  output('CPBL_GAME_LINKS',[...p.text.matchAll(/href="([^"]+)"/g)].map(m=>m[1]).filter(s=>/play|log|pbp/i.test(s)));
 }else if(league==='NPB'){
  const root='https://baseball.yahoo.co.jp/npb/game/'+g.id;
  output('NPB_GAME_LINKS',[...new Set([...p.text.matchAll(/href=["']([^"']+)["']/g)].map(m=>m[1]).filter(s=>s.includes('/game/'+g.id)))]);
  const score=await fetchPublic(root+'/score');output('NPB_SCORE_CLASSES',[...new Set([...score.text.matchAll(/class="([^"]+)"/g)].map(m=>m[1]).filter(s=>/play|inning|text|live|result|batter/i.test(s)))]);
  output('NPB_SCORE_HTML',score.text.match(/<[^>]+(?:id="(?:live|play|text)[^"]*"|class="bb-live[^" ]*")[\s\S]{0,22000}/i)?.[0]||plain(score.text).slice(-18000));
  const logLink=[...p.text.matchAll(/href=["']([^"']+)["']/g)].map(m=>m[1]).find(s=>s.includes('/game/'+g.id)&&/text|live|progress|playbyplay/.test(s));
  if(logLink){const lp=await fetchPublic(new URL(logLink,root).href);output('NPB_TEXT_HTML',lp.text.match(/<(?:div|section)[^>]+(?:id|class)="[^"]*(?:textLive|liveText|textScore|gameText|playByPlay)[^"]*"[\s\S]{0,24000}/i)?.[0]||plain(lp.text).slice(-18000));}
 }else{
  const j=JSON.parse(p.text);output('KBO_RESULT_KEYS',Object.keys(j.result||{}));output('KBO_RELAY_KEYS',Object.keys(j.result?.textRelayData||{}));
  output('KBO_RELAY',j.result?.textRelayData,34000);
 }
}catch(e){console.log('PROBE_ERROR',league,e.message);}
