import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../public/game-life/',import.meta.url),copy=x=>JSON.parse(JSON.stringify(x));
function runtime(extra={}){const ctx=vm.createContext({console,...extra});for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){const file=url.split('?')[0].split('/').pop();if(file!=='app.js')vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),ctx,{filename:file})}return{ctx,E:ctx.XZEngine,P:ctx.XZPlays,M:ctx.XZMoments}}
const {ctx,E,P,M}=runtime();
function opening(sport,seed,pace='quick',pos=['內野手','前鋒','控球後衛'][sport]){const s=E.create({sport,seed:'play-'+seed,pace,pos,length:'short'});if(sport===2)s.team=ctx.XZArena.CONFIG[2].teams[0][seed%8];s.phase='ready';E.advance(s);return s}
function fixture(sport,mode,pace='quick',pos){for(let i=0;i<80;i++){const s=opening(sport,i,pace,pos);if(s.care?.active||!s.phase.endsWith('moment'))continue;if(sport===1||(s.arena.season.moment.match.mode===mode))return s}throw Error('fixture not found: '+sport+' '+mode)}
const act=(s,i)=>s.sport===1?E.footballMoment(s,i):E.arenaMoment(s,i);

test('all manual choices in three sports animate actual decisions with unchanged state and RNG in both paces',()=>{
 for(const pace of ['quick','full'])for(const [sport,mode,pos]of [[0,'bat','內野手'],[0,'pitch','投手'],[0,'field','內野手'],[1,null,'前鋒'],[1,null,'門將'],[1,null,'中場'],[1,null,'後衛'],[2,'offence','控球後衛'],[2,'defence','控球後衛']]){
  const initial=fixture(sport,mode,pace,pos);
  for(let index=0;index<4;index++){
   const animated=copy(initial),plain=copy(initial),raw=JSON.stringify(animated),before=P.snapshot(animated,index);assert(before);assert.equal(JSON.stringify(animated),raw);
   assert(act(animated,index).ok);assert(act(plain,index).ok);assert.deepEqual(copy(animated),copy(plain));
   const saved=JSON.stringify(animated),event=P.result(before,animated);assert(event);assert.equal(event.play.label,before.label);assert.equal(event.play.success,(sport===1?animated.football:animated.arena).season.highlight.success);
   const html=M.markup([event]);assert(html.includes('球場瞬間'));assert(html.includes('本次選擇當下的比分'));assert(html.includes('約 3 秒'));assert(!html.includes('undefined'));assert(html.includes('play-ball'));assert.equal(JSON.stringify(animated),saved);assert.deepEqual(copy(E.migrate(copy(animated))),copy(animated));
  }
 }
});
test('fast completion uses the decision score rather than later simulated final scores',()=>{
 let different=0;for(const sport of [0,1,2]){const s=fixture(sport,sport===0?'bat':'offence'),b=P.snapshot(s,0);act(s,0);const h=(sport===1?s.football:s.arena).season.highlight;h.match.hg+=10;const e=P.result(b,s),own=h.match.home===s.team,final=[own?h.match.hg:h.match.ag,own?h.match.ag:h.match.hg];const expected=sport===1&&!b.ownHome?[h.after[1],h.after[0]]:copy(h.after);assert.deepEqual(copy(e.play.to),expected);if(JSON.stringify(final)!==JSON.stringify(expected))different++}assert(different>=2);
});
test('invalid choices, coach auto-play, medical interruption and reload never fabricate a manual animation',()=>{
 const s=fixture(0,'bat');assert.equal(P.snapshot(s,-1),null);assert.equal(P.snapshot(s,null),null);const b=P.snapshot(s,0);assert.equal(P.result(b,s),null);E.arenaAuto(s);assert.equal(P.result(b,s),null);
 const medical=fixture(1);medical.health=20;const mb=P.snapshot(medical,0);assert(E.footballMoment(medical,0).interrupted);assert.equal(P.result(mb,medical),null);assert.equal(P.snapshot(medical,0),null);
 const loaded=E.migrate(copy(s));assert.equal(P.snapshot(loaded,0),null);
});
test('baseball results distinguish walks, strikeouts, hits, sacrifices and double plays',()=>{
 const s=fixture(0,'bat'),b=P.snapshot(s,0);s.careerEvents=b.events+1;
 for(const [label,outcome,title]of [['一壘安打。','single','一壘安打'],['全壘打。','homer','全壘打！'],['四壞球保送。','walk','四壞球保送'],['三振。','k','三振'],['犧牲推進。','sac','犧牲推進']]){
  s.arena.season.highlight={choice:b.label,result:label,success:true,before:[1,0],after:[1,0]};const e=P.result(b,s);assert.equal(e.play.outcome,outcome);assert.equal(e.title,title);
 }
 s.arena.season.highlight.result='滾地球處理。';assert.equal(P.result({...b,bases:['team',null,null],outs:0},s).title,'滾地雙殺');assert.equal(P.result({...b,bases:[null,null,null],outs:0},s).title,'滾地出局');assert.equal(P.result({...b,bases:['team',null,null],outs:2},s).title,'滾地出局');
});
test('football safe passes and failed attempts never show a goal; basketball foul scores use actual free throws',()=>{
 const s=fixture(1),b=P.snapshot(s,0);s.careerEvents=b.events+1;s.football.season.highlight={choice:b.label,success:true,before:[0,0],after:[0,0],text:'保留球權'};
 const safe=P.result({...b,kind:'safe'},s);assert.match(safe.title,/穩住球權/);assert(!P.scene(safe).includes('data-scored="true"'));
 s.football.season.highlight.success=false;const missed=P.result(b,s);assert.match(missed.title,/被化解/);assert(!P.scene(missed).includes('data-scored="true"'));
 const ball=fixture(2,'defence'),bb=P.snapshot(ball,2);ball.careerEvents=bb.events+1;ball.arena.season.highlight={choice:bb.label,success:false,before:[50,50],after:[50,51],result:'防守犯規'};const foul=P.result(bb,ball);assert.match(foul.title,/罰球得 1 分/);
});
test('animation markup escapes player and team strings, including the score row',()=>{
 const s=fixture(1),b=P.snapshot(s,0);act(s,0);const e=P.result(b,s);e.player='<img src=x>';e.play.team='<script>';e.play.opponent='</span><img>';e.play.label='<script>';const html=M.markup([e]);assert(!html.includes('<img'));assert(!html.includes('<script>'));assert(html.includes('&lt;img'));assert(html.includes('&lt;script&gt;'));
});
test('short tactical actions can be skipped or replayed and chained medical events are not lost',()=>{
 let next=0;const timers=new Map(),listeners={},button={isConnected:true,focus(){}};const dialog={open:false,setAttribute(){},addEventListener(n,f){listeners[n]=f},querySelector(){return button},showModal(){this.open=true},close(){this.open=false}};
 const document={activeElement:button,body:{appendChild(){}},createElement(){return dialog},querySelector(){return button}};
 const {M:ui}=runtime({document,setTimeout(fn,ms){timers.set(++next,{fn,ms});return next},clearTimeout(id){timers.delete(id)}});
 const s=fixture(1),b=P.snapshot(s,0);act(s,0);const e=P.result(b,s),medical={kind:'medical',title:'醫療暫停',detail:'需要照護',player:'球員',age:16};
 ui.play([e,medical]);assert.equal([...timers.values()][0].ms,2600);assert(dialog.innerHTML.includes('球場瞬間'));
 listeners.click({target:{closest(){return true}}});assert(dialog.open);assert(dialog.innerHTML.includes('醫療暫停'));assert.equal([...timers.values()][0].ms,3400);
 ui.close();assert.equal(timers.size,0);ui.play([e],{replay:true});assert.equal(timers.size,0);assert(dialog.innerHTML.includes('重播不影響遊戲進度'));
 ui.close();ui.play([e,medical]);ui.close();assert(!dialog.open);assert.equal(timers.size,0);
});

test('tactical profiles, previews and replay preserve every career field and show the real jersey number',()=>{
 for(const [sport,mode]of [[0,'bat'],[1,null],[2,'offence']]){
  const s=fixture(sport,mode);s.number=42;s.name='測試<球員>';const raw=JSON.stringify(s),hub=sport===1?s.football:s.arena;
  const profile=ctx.XZStadium.profile(s,E),preview=ctx.XZStadium.preview(s,hub.season.moment.match),side=ctx.XZStadium.milestones(s);
  assert(profile.includes('42'));assert(profile.includes('能力雷達'));assert(!profile.includes('<球員>'));assert(preview.includes('>42</text>'));assert(side.includes('里程碑'));assert.equal(JSON.stringify(s),raw);
  const b=P.snapshot(s,0);act(s,0);const saved=JSON.stringify(s),e=P.result(b,s),html=P.scene(e);assert(html.includes('tactical-arena'));assert(html.includes('>42</text>'));assert.equal(JSON.stringify(s),saved);
 }
});
test('tactical success graphics distinguish own goals, conceded goals and scoreless possession',()=>{
 const s=fixture(1),b=P.snapshot(s,0);s.careerEvents=b.events+1;
 for(const [kind,success,after,expected]of [['goal',true,[1,0],'進球！'],['save',false,[0,1],'對手得分'],['save',true,[0,0],'成功撲救！'],['safe',true,[0,0],'穩住球權'],['goal',false,[0,0],'未能得分']]){
  s.football.season.highlight={choice:b.label,success,before:[0,0],after,text:'實際結果'};
  const e=P.result({...b,ownHome:true,kind,mode:kind==='save'?'defence':'offence'},s),html=P.scene(e);
  assert(html.includes(expected));assert.equal(html.includes('class="tactical-confetti"'),kind==='goal'&&success);
 }
});
