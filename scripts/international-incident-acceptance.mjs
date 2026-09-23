// Live public-source acceptance. No account credentials or production database.
import assert from 'node:assert/strict';
import {collectLeague,dayInTaipei} from '../server/baseball-current.mjs';
import {collectSeasonPitching} from '../server/baseball-season-pitching.mjs';
import {fetchPublic} from '../server/baseball-live-providers.mjs';
import {moduleUrl} from '../tests/profile-loader.mjs';
const {internationalTeam}=await import(moduleUrl('lib/international-teams.ts'));
const {currentPregame,pregameMissing}=await import(moduleUrl('lib/international-current-pregame.ts'));
const {supplementSeasonPitching}=await import(moduleUrl('lib/international-season-pitching.ts'));
const {buildRunAnalysis}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const {parseInternational}=await import(moduleUrl('lib/international.ts'));
const date=dayInTaipei();
for(const league of ['NPB','KBO']){
 const feed=await collectLeague(league,{date}),eligible=feed.games.filter(g=>g.status==='pregame');
 const teams=eligible.flatMap(g=>['away','home'].map(s=>internationalTeam(g[s].name,league)));
 const stats=await collectSeasonPitching(league,date,teams);
 const pregame=supplementSeasonPitching(currentPregame(league,date,feed,[]),stats),coverage=pregameMissing(pregame);
 const model=pregame.games.map(g=>{const r=buildRunAnalysis(g,Date.now(),league);return {away:g.away.team,home:g.home.team,status:r.status,reason:r.reason};});
 console.log('STARTER_ACCEPTANCE',JSON.stringify({league,date,coverage,errors:stats.errors,model,scope:'Starter repair only; a missing bullpen must still block model output'}));
 if(eligible.length){assert.ok(stats.rows.length,'season statistics missing');assert.equal(coverage.era,coverage.starters,'starter ERA coverage');assert.equal(coverage.whip,coverage.starters,'starter WHIP coverage');}
}
const p=await fetchPublic('https://tw.sports.yahoo.com/cpbl/standings/?season='+date.slice(0,4));
const standings=parseInternational(p.text,'cpbl-standings',Number(date.slice(0,4)));assert.equal(standings.tables[0].rows.length,6);
console.log('CPBL_STANDINGS_ACCEPTANCE',JSON.stringify({teams:6,rows:standings.tables[0].rows}));
const tomorrow=dayInTaipei(new Date(Date.now()+86400000)),future=await collectLeague('CPBL',{date:tomorrow});
console.log('CPBL_FUTURE_ACCEPTANCE',JSON.stringify({date:tomorrow,games:future.games.map(g=>({id:g.id,away:g.away.name,home:g.home.name,start:g.startTime,starters:g.starters})),status:future.status,errors:future.errors}));
