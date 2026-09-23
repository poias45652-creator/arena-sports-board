import {collectLeague,dayInTaipei} from '../server/baseball-current.mjs';
import {collectSeasonPitching} from '../server/baseball-season-pitching.mjs';
import {fetchPublic,yahooObjects,plain} from '../server/baseball-live-providers.mjs';
const date=dayInTaipei();
for(const league of ['KBO','NPB']){
 const feed=await collectLeague(league,{date});
 const result=await collectSeasonPitching(league,date);
 console.log('FIX_STATS',JSON.stringify({league,rows:result.rows.length,errors:result.errors,sources:result.sources,starters:feed.games.filter(g=>g.status==='pregame').flatMap(g=>['away','home'].map(s=>({team:g[s].name,pitcher:g.starters[s]?.name,matches:result.rows.filter(r=>r.name===g.starters[s]?.name||['J・ルケーシー','ルケーシー'].includes(r.name)&&['J・ルケーシー','ルケーシー'].includes(g.starters[s]?.name)).map(r=>({name:r.name,team:r.team,stats:r.stats}))})))}));
}
for(const name of ['富邦','統一']){
 try{const page=await fetchPublic('https://tw.sports.yahoo.com/cpbl/teams/'+encodeURIComponent(name)+'/');
 const objects=yahooObjects(page.text);console.log('CPBL_SCHEDULE_SHAPE',JSON.stringify({team:name,title:plain(page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''),objects:objects.length,games:objects.filter(x=>x.gameId&&String(x.gameId).startsWith('cpbl.')).map(x=>({id:x.gameId,start:x.startTime,status:x.status,phase:x.seasonPhase,home:x.homeTeamId,away:x.awayTeamId,url:x.alias?.url})).slice(-12)}));}catch(e){console.log('CPBL_SOURCE_ERROR',e.message);}
}
