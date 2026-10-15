import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {moduleUrl} from './profile-loader.mjs';
const {parseFootballDetail,parseFootballStandings,attachFootballStandingForm}=await import(moduleUrl('lib/football-live.ts'));
const {parseFootballEvents,FOOTBALL_LEAGUES}=await import(moduleUrl('lib/football.ts'));
const read=name=>JSON.parse(readFileSync('tests/fixtures/football-live/'+name+'.json','utf8'));
const raw=read('champions-summary'),game=parseFootballEvents(read('champions-schedule'),'uefa.champions').find(g=>g.id===raw.header.id),stamp='2026-10-15T18:00:00Z';
test('recorded Champions League summary keeps away/home score, stats, lineups, event clocks and verified photo endpoints',()=>{
 const d=parseFootballDetail(raw,game,stamp);
 assert.equal(d.game.away.name,'科莫');assert.equal(d.game.home.name,'飛燕諾');assert.equal(d.game.awayScore,2);assert.equal(d.game.homeScore,3);assert.equal(d.attendance,43951);
 assert.deepEqual(d.stats.find(s=>s.key==='possessionPct'),{key:'possessionPct',label:'控球率',away:'52.2%',home:'47.8%'});
 assert.equal(d.lineups[0].players.filter(p=>p.starter).length,11);assert.equal(d.lineups[1].players.filter(p=>p.starter).length,11);
 assert.ok(d.lineups.every(t=>t.players.every(p=>p.photo.includes('team='+t.team.id)&&p.photo.includes('season=2026'))));
 assert.equal(d.events.length,31);assert.equal(d.commentary.length,132);assert.match(d.commentary[0].text,/ends|ended/i);
 for(let i=1;i<d.events.length;i++)assert.ok(d.events[i-1].period>d.events[i].period||d.events[i-1].period===d.events[i].period&&d.events[i-1].seconds>=d.events[i].seconds);
 assert.equal(d.events.filter(e=>e.type==='goal'||e.type==='own-goal').length,5);
});
test('summary mismatches are rejected and missing fields never turn into zero statistics or invented starters',()=>{
 for(const patch of [{id:'999'},{league:'uefa.europa'},{start:'2026-10-14T17:45:00.000Z'},{home:game.away}])assert.throws(()=>parseFootballDetail(raw,{...game,...patch},stamp),/不符/);
 const blank=structuredClone(raw);delete blank.boxscore;delete blank.rosters;delete blank.gameInfo;delete blank.keyEvents;delete blank.commentary;
 const d=parseFootballDetail(blank,game,stamp);assert.ok(d.stats.every(s=>s.home==='—'&&s.away==='—'));assert.equal(d.attendance,null);assert.ok(d.lineups.every(t=>!t.players.length));assert.deepEqual(d.events,[]);
});
test('all eight real league tables preserve season identity, groups, points and latest five results',()=>{
 const expected={'eng.1':20,'esp.1':20,'ita.1':20,'ger.1':18,'fra.1':18,'uefa.champions':36,'uefa.europa':36,'uefa.nations':54};
 for(const {code} of FOOTBALL_LEAGUES){const raw=read(code+'-standings'),table=parseFootballStandings(raw,code,2026,stamp),history=JSON.parse(gunzipSync(readFileSync('tests/fixtures/football-live/'+code+'-year.json.gz'))),d=attachFootballStandingForm(table,[history],Date.parse(stamp));
  assert.equal(d.groups.reduce((n,g)=>n+g.rows.length,0),expected[code],code);assert.ok(d.groups.every(g=>g.rows.every(r=>r.form.length<=5)));
  assert.ok(d.groups.some(g=>g.rows.some(r=>r.form.length>0)),code+' has recent games');
  if(code==='uefa.nations')assert.equal(d.groups.length,14);
  if(code==='uefa.champions'){assert.equal(d.groups[0].rows[0].team.name,'巴黎聖日耳曼');assert.equal(d.groups[0].rows[0].points/d.groups[0].rows[0].games,3);assert.deepEqual(d.groups[0].rows[0].form,['W','W']);}
  assert.throws(()=>parseFootballStandings(raw,code,2025,stamp),/不符/);
 }
 assert.throws(()=>parseFootballStandings(read('uefa.champions-standings'),'uefa.europa',2026,stamp),/不符/);
});
test('future results and wrong seasons cannot leak into recent form',()=>{
 const table=parseFootballStandings(read('uefa.champions-standings'),'uefa.champions',2026,stamp),d=attachFootballStandingForm(table,[read('champions-schedule')],Date.parse('2026-01-01T00:00:00Z'));
 assert.ok(d.groups.every(g=>g.rows.every(r=>r.form.length===0)));
});
