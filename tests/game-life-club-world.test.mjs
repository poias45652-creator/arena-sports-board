import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../public/game-life/',import.meta.url);
function load(world=true){
 const ctx=vm.createContext({console});
 for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){
  const file=url.split('?')[0].split('/').pop();if(file==='app.js'||(!world&&file==='club-world.js'))continue;
  let src=fs.readFileSync(new URL(file,base),'utf8');
  if(file==='engine.js')src=src.replace('const api={','const api={testContext:footballContext,');
  vm.runInContext(src,ctx,{filename:file});
 }
 return ctx;
}
const ctx=load(),{XZEngine:E,XZArena:A,XZFootball:F,XZClubWorld:W,XZOrigins:O}=ctx;
const plain=x=>JSON.parse(JSON.stringify(x));
const player=(sport,country='台灣')=>E.create({sport,country,name:'台北雷霆',pos:['投手','前鋒','控球後衛'][sport],seed:'club-world-'+sport,pace:'quick'});
test('every professional club has a unique sport-scoped display name and a sourced strength',()=>{
 const names=new Set();let count=0;
 for(const sport of [0,1,2])for(const club of sport===1?F.CLUBS:A.CLUBS.filter(c=>c.sport===sport)){
  if(club.league==='academy')continue;
  const row=W.get(sport,club.name);assert(row,`${sport} ${club.name}`);
  assert.equal(club.displayName,row.name);assert.equal(club.power,row.power);
  assert(row.name!==row.id);assert(row.reference);assert(row.source.startsWith('https://'));
  assert(Number.isInteger(club.power)&&club.power>=28&&club.power<=99);
  assert(!names.has(sport+'|'+row.name));names.add(sport+'|'+row.name);count++;
 }
 assert.equal(count,256);
 assert.notEqual(W.name(1,'新竹極光'),W.name(2,'新竹極光'));
});
test('actual relative strength replaces the old index pattern and every development team stays weaker',()=>{
 assert(A.findClub('洛城星辰',0).power>A.findClub('西雅圖遠航',0).power);
 assert(A.findClub('水原銀河',0).power>A.findClub('大田天狼',0).power);
 assert(F.findClub('慕尼黑雄獅').power>F.findClub('漢堡北港').power);
 assert(A.findClub('紐約帝國',2).power>A.findClub('達城荒原',2).power);
 for(const row of W.RECORDS.filter(r=>r.development)){
  const parent=W.RECORDS.find(r=>r.sport===row.sport&&r.name+'育成'===row.name);
  assert(parent);assert.equal(row.power,parent.power-20);
 }
});
test('loading legacy contracts, history and live matches never renames or rewrites persisted data',()=>{
 const old=load(false),OE=old.XZEngine;
 for(const sport of [0,1,2]){
  const s=OE.create({sport,name:'舊生涯',pos:['投手','前鋒','控球後衛'][sport],seed:'old-clubs-'+sport,pace:'quick'});
  (sport===1?old.XZFootball:old.XZArena).makeOffers(s,OE.testContext());
  s.phase='ready';assert((sport===1?old.XZFootball:old.XZArena).beginSeason(s,OE.testContext()).ok);
  const before=JSON.stringify(s),loaded=E.migrate(plain(s));assert.equal(JSON.stringify(loaded),before);
  const hub=sport===1?loaded.football:loaded.arena;
  assert.equal(JSON.stringify(hub.season),JSON.stringify((sport===1?s.football:s.arena).season));
  assert.equal(loaded.name,'舊生涯');
 }
});
test('HUD, offers, scoreboards and archives show new club names without altering personal names or state',()=>{
 for(const sport of [0,1,2]){
  const s=player(sport),api=sport===1?F:A;api.makeOffers(s,E.testContext());
  const before=JSON.stringify(s),label=W.name(sport,s.team);
  const hud=ctx.XZFocus.hud(s,E),offers=ctx.XZEasy.contracts(s);
  assert(hud.includes(label));assert(hud.includes('台北雷霆'));
  for(const o of s.offers)assert(offers.includes(W.name(sport,o.team)));
  assert.equal(JSON.stringify(s),before);
  s.phase='ready';assert(api.beginSeason(s,E.testContext()).ok);
  const ui=sport===1?ctx.XZFootballUI:ctx.XZArenaUI;
  const inMatch=JSON.stringify(s),stage=ui.stage(s),archive=ui.career(s);
  assert(stage.includes(label));assert(archive.includes(label));
  assert.equal(JSON.stringify(s),inMatch);
 }
});
test('all countries retain their domestic entry and fixed short season length with the new strengths',()=>{
 for(const sport of [0,1,2])for(const country of O.COUNTRIES){
  const s=player(sport,country),api=sport===1?F:A;
  assert.equal(O.current(s).country,country);
  s.phase='ready';assert(api.beginSeason(s,E.testContext()).ok);
  const season=(sport===1?s.football:s.arena).season;
  assert.equal(season.rounds.length,[42,14,28][sport]);
  for(const row of season.table)assert(W.get(sport,row.team));
  E.validate(s);
 }
});
