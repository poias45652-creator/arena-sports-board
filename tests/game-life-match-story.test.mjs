import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../public/game-life/',import.meta.url),ctx=vm.createContext({console});
for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){
 const file=url.split('?')[0].split('/').pop();if(file!=='app.js')vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),ctx,{filename:file});
}
const {XZEngine:E,XZEasy:U,XZMatchStory:N,XZFeats:T,XZFootball:F,XZArena:A,XZDynamics:D}=ctx;
const copy=s=>JSON.parse(JSON.stringify(s));
const player=(sport=0,seed='clear-ui',pos)=>E.create({sport,pos:pos||['內野手','前鋒','控球後衛'][sport],seed,length:'short',pace:'quick'});
function opening(sport,seed){const s=player(sport,seed);s.phase='ready';E.advance(s);return s}

test('requested panels disappear, customization stays open, and removed challenges cannot run through preparation',()=>{
 for(const sport of [0,1,2]){
  const s=player(sport),saved=JSON.stringify(s),html=U.training(s,E);
  assert(html.includes('<section class="prep-custom"'));assert(!html.includes('<details class="focus-more prep-custom"'));
  assert(!html.includes('本季限定'));assert(!html.includes('prep-opportunity'));assert.equal((html.match(/class="easy-plan"/g)||[]).length,3);
  assert.equal(JSON.stringify(s),saved);
  assert(U.run(s,'contend',E).ok);assert.equal(s.preparation,undefined);assert.equal(s.sessions,3);E.validate(s);
 }
 const app=fs.readFileSync(new URL('app.js',base),'utf8');
 const overview=app.slice(app.indexOf('function playerOverview'),app.indexOf('\n',app.indexOf('function playerOverview')));
 assert(!overview.includes('XZCare.statusHTML'));assert(!overview.includes('moodSupport'));
 assert(app.includes('XZCare.stageHTML(s)')); // Existing care progress still resumes.
});

test('the reported football scene becomes clear while real probabilities, costs and safe outcomes stay accurate',()=>{
 const s=player(1),m={home:s.team,away:'測試隊',hg:1,ag:2,round:1,reads:{goal:1}},sit={title:'看穿對方佈陣，找到突破口',text:'測試'},profile=F.OPPONENTS[0];
 const scene=['被貼身盯住的夜晚','對手不讓你輕鬆轉身，一個微小的觸球空間出現在身側。'];
 const source=JSON.stringify(s),html=N.scene(s,m,sit,profile,scene,78);
 assert(html.includes('78 分鐘 · 落後 1 球'));assert(html.includes('對手貼住你，隊友正往前跑'));assert(html.includes('自己射，還是傳給他'));
 assert(!html.includes('微小的觸球空間'));assert.equal(JSON.stringify(s),source);
 const attack=['變向後迅速起腳',2,'goal',.46],info={p:.4,pressure:55,parts:[['對手',-.08]]};
 const card=N.card(s,attack,0,info,m,D);assert(card.includes('轉身射門'));assert(card.includes('40%'));assert(card.includes('成功率'));assert(card.includes('你進 1 球，球隊 +1'));assert(card.includes('射門被擋'));assert(card.includes('對手已看過這招'));assert(card.includes('健康 -3'));assert(card.includes('失敗：士氣 -5'));
 const safe=N.card(s,['保留球權',5,'safe',null],2,{p:null,parts:[]},m,D);assert(safe.includes('信任 +1'));assert(safe.includes('不判定成敗'));assert(!safe.includes('士氣 +2'));
});

test('three sports render real matches and results without drawing RNG, writing saves or confusing the final score with one action',()=>{
 for(const sport of [0,1,2]){let seen=0;
  for(let i=0;i<12&&seen<3;i++){
   const s=opening(sport,'readable-'+i),expected=sport===1?'football-moment':'arena-moment';if(s.phase!==expected)continue;seen++;
   const saved=JSON.stringify(s),ui=sport===1?ctx.XZFootballUI:ctx.XZArenaUI;
   const html=ui.stage(s);assert(html.includes('match-scene'));assert(html.includes('branch-good'));assert(html.includes('branch-bad'));assert(html.includes('match-chase'));assert(!html.includes('probability-factors'));
   assert.equal(JSON.stringify(s),saved);assert.deepEqual(copy(E.migrate(copy(s))),copy(s));
   const action=sport===1?E.footballMoment:E.arenaMoment;assert(action(s,0).ok);const h=(sport===1?s.football:s.arena).season.highlight;
   const after=JSON.stringify(s),result=N.result(s,h),render=ui.stage(s);assert(result.includes('剛才這個選擇'));assert(render.includes('match-payoff'));assert.equal(JSON.stringify(s),after);E.validate(s);
  }assert.equal(seen,3);
 }
 const s=player(2),h={before:[70,72],after:[73,72],match:{home:s.team,away:'客隊',hg:90,ag:97,round:1},choice:'三分',chance:.4,success:true};
 assert(N.result(s,h).includes('我方 +3 分'));assert(!N.result(s,h).includes('勝利'));
});

test('title progress respects roles, already-owned titles and actual match stats, including partial football stats',()=>{
 const s=player(2),m={player:{pts:29,ast:3,reb:2}};assert(N.chase(s,m).includes('29 / 30'));assert(N.chase(s,m).includes('還差 1 分'));
 s.feats={v:1,titles:[{id:'scorer',age:16,match:'驗證'}],awakening:null};assert(!N.chase(s,m).includes('烈焰得分手'));
 const pitcher=player(0,'pitcher','投手');assert(!N.chase(pitcher,{player:{k:7,h:3}}).includes('穿線巧匠'));assert(N.chase(pitcher,{player:{k:7}}).includes('7 / 8'));
 const football=player(1);assert(N.chase(football,{personalGoal:2}).includes('2 / 3'));assert(N.chase(football,{personalGoal:2}).includes('親自決策已累積'));
 const keeper=player(1,'keeper','門將');assert(N.chase(keeper,{extraSave:6}).includes('孤城守望者'));
 const title=T.TITLES['cold-rim'];assert(N.earned(s,{earnedTitles:['cold-rim'],clearedTitles:[]}).includes(title.name));
});

test('the twelve new emotional scenes have distinct outcomes, meaningful branches, and safe migrated histories',()=>{
 const ids=['home-seat','home-call','home-return','last-locker','old-number','old-visit','rival-hand','rival-rematch','rival-film','diamond-note','football-shoes','basket-empty'];
 for(const id of ids){const event=E.byId['turn-'+id];assert(event,id);assert(event.text.length<110);assert(event.once);assert(event.options.length<=3);
  assert.equal(new Set(event.options.map(c=>c.resultText||c.successText)).size,event.options.length);
  for(let i=0;i<event.options.length;i++){
   const s=player(event.sport??0);s.phase='event';s.event=event.id;s.eventRules=4;s.eventsLeft=1;s.seasonEvents=1;s.visits[event.id]=1;
   assert(E.choose(s,i).ok);assert(s.outcome.narrative.length>20);E.validate(s);assert.deepEqual(copy(E.migrate(copy(s))),copy(s));
   for(const key of ['chain','chainSuccess','chainFailure'])if(event.options[i][key])assert(E.byId[event.options[i][key]].chainOnly);
  }
 }
 const first=player(),second=copy(first);for(const s of [first,second]){s.phase='event';s.event='turn-home-seat';s.eventRules=4;s.eventsLeft=1;s.seasonEvents=1;}
 E.choose(first,0);E.choose(second,1);assert(first.pending.some(p=>p.id==='turn-home-call'));assert(second.pending.some(p=>p.id==='turn-home-return'));assert(!first.pending.some(p=>p.id==='turn-home-return'));
});

test('family and opponent names are escaped and an estranged partner is not narrated as a happy relationship',()=>{
 const s=player(1);s.family={partner:'<img onerror=x>',stage:'dating',child:null};s.romance={bond:'strained'};
 assert(!N.pulse(s,{round:1}).includes('今天回去'));s.romance.bond='stable';
 const html=N.scene(s,{home:s.team,away:'客隊',hg:0,ag:0,round:1},{title:'測試',text:'測試'},{text:'<script>對手</script>'},['對決','短敘事'],70);
 assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(html.includes('&lt;img'));
});

test('ordinary stories get topic-specific emotional endings without overwriting authored scenes or consuming RNG',()=>{
 const V=ctx.XZVariety,s=player(),before=JSON.stringify(s),endings=new Set();
 for(const e of ctx.XZContent.EVENTS.filter(e=>/^v5-/.test(e.id)&&!e.chainOnly)){
  for(const success of [true,false]){const text=V.result(e,e.options[0],success,s);endings.add(text);assert.equal(text,V.result(e,e.options[0],success,s));assert(text.length<150);}
 }
 assert(endings.size>=20);assert.equal(JSON.stringify(s),before);
 const e=E.byId['turn-home-seat'];assert.equal(V.result(e,e.options[0],true,s),e.options[0].resultText);
 const saved=player();saved.phase='event';saved.event='v5-training-1';saved.eventRules=4;saved.eventsLeft=1;saved.seasonEvents=1;
 E.choose(saved,0);const narrative=saved.outcome.narrative;assert.equal(E.migrate(copy(saved)).outcome.narrative,narrative);
});
