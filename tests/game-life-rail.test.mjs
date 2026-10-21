import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../public/game-life/',import.meta.url),ctx=vm.createContext({console});
for(const [,url] of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){
 const file=url.split('?')[0].split('/').pop();if(file!=='app.js')vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),ctx,{filename:file});
}
const {XZEngine:E,XZRail:R,XZArena:A,XZFootball:F,XZClubWorld:W}=ctx;
const player=sport=>E.create({sport,pos:['投手','前鋒','控球後衛'][sport],seed:'rail-real-season-'+sport,length:'short',pace:'quick',country:'日本'});
test('all three sports show the real completed-match table without counting the current match or changing saves',()=>{
 for(const sport of [0,1,2]){
  const s=player(sport);s.phase='ready';assert(E.advance(s).ok);
  const y=(sport===1?s.football:s.arena).season,source=JSON.stringify(s),rows=(sport===1?F:A).sortedTable(y),html=R.context(s);
  assert(html.includes('本季排名'));assert(html.includes('只計入已完賽場次'));
  assert.equal((html.match(/<th scope="row">/g)||[]).length,y.table.length);
  let last=-1;for(const row of rows){const offset=html.indexOf(W.name(sport,row.team),last+1);assert(offset>last);last=offset;}
  assert(html.includes(sport===1?'積分':'勝率'));assert(html.includes('我方'));
  assert.equal(JSON.stringify(s),source);
  assert.deepEqual(JSON.parse(JSON.stringify(E.migrate(JSON.parse(source)))),JSON.parse(source));
 }
});
test('stories, outcomes, contracts, results and retirement have relevant context without stale season claims',()=>{
 for(const sport of [0,1,2]){
  const s=player(sport);s.history=[{age:16,team:s.team,o:48,cup:false,award:false,inj:true}];s.peak=48;
  for(const phase of ['event','outcome','contract','ready','result']){
   s.phase=phase;const saved=JSON.stringify(s),html=R.context(s);
   assert(html.includes('生涯足跡'));assert(html.includes('走過傷病'));assert(!html.includes('本場戰況'));
   assert.equal(JSON.stringify(s),saved);
  }
  s.retired=true;assert(R.context(s).includes('已留下的故事'));
  s.retired=false;s.phase='ready';E.advance(s);s.age++;
  assert(!R.context(s).includes('aria-label="本季排名"'));
 }
});
test('relationship context escapes names and preserves separation and child history',()=>{
 const s=player(0);s.age=26;s.family={stage:'parent',partner:'<script>前任</script>',child:{name:'<img src=x>',bornAt:24}};s.romance={bond:'separated'};
 const source=JSON.stringify(s),html=R.context(s);
 assert(html.includes('已分開'));assert(html.includes('孩子 · 2 歲'));assert(html.includes('&lt;script&gt;前任&lt;/script&gt;'));
 assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(!html.includes('一起育兒'));
 assert.equal(JSON.stringify(s),source);
});
