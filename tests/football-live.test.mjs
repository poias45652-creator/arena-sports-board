import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {moduleUrl} from './profile-loader.mjs';
const {parseFootballDetail,parseFootballStandings,attachFootballStandingForm}=await import(moduleUrl('lib/football-live.ts'));
const {parseFootballEvents,FOOTBALL_LEAGUES}=await import(moduleUrl('lib/football.ts'));
const {footballTeamName}=await import(moduleUrl('lib/football.ts'));
const {footballCommentaryText,footballCommentaryNames}=await import(moduleUrl('lib/football-commentary.ts'));
const read=name=>JSON.parse(readFileSync('tests/fixtures/football-live/'+name+'.json','utf8'));
const raw=read('champions-summary'),game=parseFootballEvents(read('champions-schedule'),'uefa.champions').find(g=>g.id===raw.header.id),stamp='2026-10-15T18:00:00Z';
test('recorded Champions League summary keeps away/home score, stats, lineups, event clocks and verified photo endpoints',()=>{
 const d=parseFootballDetail(raw,game,stamp);
 assert.equal(d.game.away.name,'科莫');assert.equal(d.game.home.name,'飛燕諾');assert.equal(d.game.awayScore,2);assert.equal(d.game.homeScore,3);assert.equal(d.attendance,43951);
 assert.deepEqual(d.stats.find(s=>s.key==='possessionPct'),{key:'possessionPct',label:'控球率',away:'52.2%',home:'47.8%'});
 assert.equal(d.lineups[0].players.filter(p=>p.starter).length,11);assert.equal(d.lineups[1].players.filter(p=>p.starter).length,11);
 assert.ok(d.lineups.every(t=>t.players.every(p=>p.photo.includes('team='+t.team.id)&&p.photo.includes('season=2026'))));
 assert.equal(d.events.length,31);assert.equal(d.commentary.length,132);assert.equal(d.commentary[0].text,'比賽結束，飛燕諾 3，科莫 2。');
 for(let i=1;i<d.events.length;i++)assert.ok(d.events[i-1].period>d.events[i].period||d.events[i-1].period===d.events[i].period&&d.events[i-1].seconds>=d.events[i].seconds);
 assert.equal(d.events.filter(e=>e.type==='goal'||e.type==='own-goal').length,5);
});
test('both recorded Champions League matches translate every commentary and event without losing records',()=>{
 for(const name of ['champions-summary','champions-summary-second']){
  const raw=read(name),game=parseFootballEvents({events:[raw.header]},'uefa.champions')[0],d=parseFootballDetail(raw,game,stamp);
  assert.equal(d.commentary.length,raw.commentary.length);
  for(const e of [...d.commentary,...d.events]){assert.equal(e.sourceText,undefined,e.sourceText);if(e.text)assert.match(e.text,/[\p{Script=Han}]/u);}
  assert.ok(d.events.every(e=>!/[a-z]/i.test(e.label.replace('VAR',''))));
 }
});
test('the reported AZ–Hapoel match translates all 115 real entries including exact screenshot actions',()=>{
 const raw=read('europa-commentary'),names=Object.fromEntries(raw.players.map(p=>[p,p]));
 for(const t of raw.teams){names[t.displayName]=footballTeamName(t.displayName);names[t.abbreviation]=footballTeamName(t.displayName);}
 footballCommentaryNames(raw.commentary.map(e=>e.text),names,n=>names[n]||footballTeamName(n));
 const translated=raw.commentary.map(e=>footballCommentaryText(e.text,names));
 assert.equal(translated.length,115);for(const [i,e] of translated.entries())assert.equal(e.sourceText,undefined,raw.commentary[i].text);
 const tr=source=>footballCommentaryText(source,names).text;
 assert.equal(tr('Calvin Stengs (AZ) is shown the yellow card for a bad foul.'),'Calvin Stengs （阿爾克馬爾） 因犯規被出示黃牌。');
 assert.equal(tr('Foul by Calvin Stengs (AZ).'),'Calvin Stengs （阿爾克馬爾） 犯規。');
 assert.equal(tr("Lucas Ventura (Hapoel Be'er Sheva) wins a free kick in the defensive half."),'Lucas Ventura （比爾舒華夏普爾） 在己方半場獲得自由球。');
 assert.equal(tr("Substitution, Hapoel Be'er Sheva. Adrián Ugarriza replaces Igor Zlatanovic."),'比爾舒華夏普爾 換人：Adrián Ugarriza 上場，Igor Zlatanovic 下場。');
 assert.equal(tr("Goal! AZ 2, Hapoel Be'er Sheva 1. Mexx Meerdink (AZ) converts the penalty with a left footed shot to the high centre of the goal."),'進球！阿爾克馬爾 2，比爾舒華夏普爾 1。Mexx Meerdink （阿爾克馬爾） 十二碼罰進，以左腳射門 射入球門中央上方。');
});
test('Chinese commentary preserves decisions, source spellings and names that contain action words',()=>{
 const texts=['Second yellow card to Ben White (Arsenal) for a bad foul.','VAR Decision: No Goal Arsenal.','VAR Decision: Penalty cancelled Arsenal.','Own Goal by Ben White, Arsenal. Arsenal 0, Chelsea 1.','Substitution, Arsenal. Myles Lewis-Skelly replaces Ben White because of an injury.','Attempt saved. Ben White (Arsenal) right footed shot from outside the box is saved in the bottom left corner.','Penalty missed! Ben White (Arsenal) fails to capitalise on this great opportunity, right footed shot misses to the left.'];
 const names=footballCommentaryNames(texts,{Chelsea:footballTeamName('Chelsea')},footballTeamName),results=texts.map(t=>footballCommentaryText(t,names));
 for(const e of results)assert.equal(e.sourceText,undefined,e.sourceText);
 assert.match(results[0].text,/Ben White.*第二張黃牌，兩黃一紅/);assert.match(results[1].text,/進球無效/);assert.match(results[2].text,/取消十二碼/);assert.match(results[3].text,/Ben White 自擺烏龍/);
 assert.match(results[4].text,/Myles Lewis-Skelly 上場，Ben White 因傷下場/);assert.doesNotMatch(results[5].text,/撲救：|射入/);assert.match(results[6].text,/十二碼未進/);assert.doesNotMatch(results[6].text,/罰進/);
 const unknown='Play suspended pending an unusual stadium inspection.';assert.equal(footballCommentaryText(unknown).sourceText,unknown);assert.match(footballCommentaryText(unknown).text,/尚待翻譯/);
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
