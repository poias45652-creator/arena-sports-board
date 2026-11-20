import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {moduleUrl} from './profile-loader.mjs';
const {parseFootballDetail,parseFootballStandings,attachFootballStandingForm}=await import(moduleUrl('lib/football-live.ts'));
const {parseFootballEvents,FOOTBALL_LEAGUES}=await import(moduleUrl('lib/football.ts'));
const {espnPitchActions:pitchActions,newPitchFrames}=await import(moduleUrl('lib/football-pitch.ts'));
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

test('pitch uses measured shot endpoints and rotates the away team into the home-left layout',()=>{
 const goal=raw.commentary.find(row=>row.play?.id==='53627826');
 const recorded={...raw,commentary:[goal],keyEvents:[]};
 const d=parseFootballDetail(recorded,game,stamp);
 const e=d.pitch.actions[0];
 assert.equal(e.label,'進球');assert.equal(e.teamId,game.away.id);
 assert.equal(e.clock,"90'+3'");assert.equal(e.point.x,14);assert.equal(e.end.x,0);
 const missing={...goal,play:{...goal.play,fieldPositionX:null,fieldPosition2X:120}};
 assert.equal(parseFootballDetail({...recorded,commentary:[missing]},game,stamp).pitch.actions[0].point,undefined);
});

test('Tipsme live snapshots bind the league, kickoff and both sides before updating the pitch',async()=>{
 const {applyTipsmeLive}=await import('../server/tipsme-football.mjs');
 const start='2026-11-20T12:00:00Z',checked='2026-11-20T13:16:00Z';
 const game={league:'hkg.1',start,state:'live',statusLabel:'進行中',home:{id:'LM',name:'理文',englishName:'LEE MAN'},away:{id:'ND',name:'高力北區',englishName:'NORTH DISTRICT'},homeScore:0,awayScore:0};
 const native={game,pitch:{clock:'37′',actions:[{id:'old-card'}]},stats:[{key:'yc',label:'黃牌',home:2,away:2}]};
 const row={status:'live',kickoffUtc:start,competition:{name:'Hong Kong Premier League'},home:{name:'Lee Man FC'},away:{name:'Golik North District'},minute:'61',score:{current:'1-0'},corners:'7-2',homeCards:{yellow:3},awayCards:{yellow:3}};
 const next=applyTipsmeLive(native,[row],checked);
 assert.deepEqual([next.game.homeScore,next.game.awayScore,next.pitch.clock],[1,0,'61′']);
 assert.equal(next.pitch.actions,native.pitch.actions);
 assert.deepEqual(next.stats.map(s=>[s.label,s.home,s.away]),[['黃牌',3,3],['角球',7,2]]);
 for(const bad of [{minute:'32'},{away:row.home},{competition:{name:'FA Cup'}},{kickoffUtc:'2026-11-21T12:00:00Z'}]){
   assert.equal(applyTipsmeLive(native,[{...row,...bad}],checked),native);
 }
 assert.equal(applyTipsmeLive(native,[row,row],checked),native);
 const final={...native,game:{...game,state:'final'}};
 assert.equal(applyTipsmeLive(final,[row],checked),final);
});

test('Bayern–Cologne pitch follows consecutive measured passes, including multiple passes in one minute',()=>{
 const {home,away}=game;
 const recorded=(id,seconds,x,y,endX,endY)=>({id,type:{type:'pass'},period:{number:1},valid:true,
   clock:{value:seconds,displayValue:"1'"},team:{$ref:'http://sports.core.api.espn.com/v2/sports/soccer/leagues/ger.1/seasons/2026/teams/122?lang=en&region=us'},
   wallclock:new Date(Date.parse('2026-11-20T19:30:17Z')+seconds*1000).toISOString(),fieldPositionX:x,fieldPositionY:y,fieldPosition2X:endX,fieldPosition2Y:endY});
 const a=recorded('55408241',2,28.6,55.9,28.2,48.1),b=recorded('55408242',5,28.2,48.1,72.9,18.1);
 const transform=rows=>pitchActions([],[],{...home,id:'132'},{...away,id:'122'},[],undefined,rows);
 assert.deepEqual(transform([a,b,b]).map(e=>[e.id,e.label,e.teamId]),[[b.id,'傳球','122'],[a.id,'傳球','122']]);
 assert.equal(transform([a])[0].id,a.id);
 assert.deepEqual(transform([a,b])[0].point,transform([a])[0].end);
 assert.deepEqual(transform([b])[0].end,{x:100-72.9,y:100-18.1});
 assert.deepEqual(transform([{...a,valid:false},{...b,team:{$ref:'https://example.org/teams/123'}}]),[]);
 assert.equal(transform([{...b,fieldPositionX:null}])[0].end,undefined);
});

test('live play reader follows the last page, coalesces viewers and recovers after an upstream failure',async t=>{
 const {liveFootballPlays}=await import(moduleUrl('lib/football-play-feed.ts'));
 let now=100000,stage=1;
 t.mock.method(Date,'now',()=>now);
 const requests=[];
 t.mock.method(globalThis,'fetch',async input=>{
   const url=new URL(input),page=Number(url.searchParams.get('page'));
   requests.push(page);
   if(stage===3)throw Error('feed offline');
   const pageCount=stage===1?8:9;
   const ids=page===8?['1','2']:page===9?(stage===4?['3','5']:['3','4']):['0'];
   return Response.json({$ref:url.origin+url.pathname,pageCount,pageIndex:page,items:ids.map(id=>({id}))});
 });
 const game={league:'ger.1',id:'401884736'};
 const [a,b]=await Promise.all([liveFootballPlays(game),liveFootballPlays(game)]);
 assert.deepEqual(a,b);assert.deepEqual(requests,[1,8,7]);assert.deepEqual(a.map(x=>x.id),['0','1','2']);
 now+=5000;stage=2;const rollover=await liveFootballPlays(game);
 assert.deepEqual(requests,[1,8,7,8,9]);assert.deepEqual(rollover.map(x=>x.id),['1','2','3','4']);
 now+=5000;stage=3;assert.deepEqual(await liveFootballPlays(game),rollover);
 now+=11000;stage=4;assert.deepEqual((await liveFootballPlays(game)).map(x=>x.id),['1','2','3','5']);
});


test('newly published bursts still animate in chronological order after the previous play leaves the list',()=>{
 const play=n=>({id:String(n),occurredAt:new Date(1795203000000+n*1000).toISOString()});
 const batch=[play(25),play(22),play(20),play(3)];
 assert.deepEqual(newPitchFrames(batch,play(4)).map(p=>p.id),['20','22','25']);
 assert.deepEqual(newPitchFrames(batch,play(22)).map(p=>p.id),['25']);
 assert.deepEqual(newPitchFrames(batch).map(p=>p.id),['25']);
});

test('停在 45 分鐘補時時，43 分鐘三次真實傳球逐筆顯示，跨過 25 秒仍保有球位',async t=>{
 const {createPitchPlayback,pitchPlaybackActions}=await import(moduleUrl('lib/football-pitch.ts'));
 const start=Date.parse('2026-11-20T20:15:51Z');
 t.mock.timers.enable({apis:['setTimeout','Date'],now:start});
 const touch=(id,stamp,x,y)=>({id,label:'傳球',type:'pass',clock:"43'",teamId:'122',occurredAt:'2026-11-20T'+stamp+'Z',point:{x,y}});
 const passes=[touch('55409633','20:13:11',69.8,50.1),touch('55409632','20:13:10',63.1,69.3),touch('55409631','20:13:04',68.2,74.1)];
 const headline={id:'headline',clock:"45'+1'",label:'補時'};
 const displays=[];
 const player=createPitchPlayback((action,moving)=>displays.push([action.id,moving,action.point]));
 const update=rows=>player.update(pitchPlaybackActions([headline,...rows]));
 update(passes);
 for(let i=0;i<8;i++){t.mock.timers.tick(4500);update(passes);}
 assert.deepEqual(displays.filter(row=>row[1]).map(row=>row[0]),passes.map(a=>a.id).reverse());
 assert.deepEqual(displays.at(-1),[passes[0].id,false,passes[0].point]);
 const later={...touch('55409826','20:16:59',15.5,48.6),clock:"45'+2'",teamId:'132'};
 t.mock.timers.setTime(Date.parse('2026-11-20T20:18:00Z'));
 update([later,...passes]);update(passes);
 assert.deepEqual(displays.at(-1),[later.id,true,later.point]);
 t.mock.timers.tick(4500);player.stop();
 assert.deepEqual(displays.at(-1),[later.id,false,later.point]);
});

test('每批超過八筆的逐球依時序播放，下一次輪詢可在播放中接續',async t=>{
 const {createPitchPlayback}=await import(moduleUrl('lib/football-pitch.ts'));
 const start=Date.parse('2026-11-20T20:18:00Z');
 t.mock.timers.enable({apis:['setTimeout','Date'],now:start});
 const play=n=>({id:String(n),clock:"45'",occurredAt:new Date(start-60000+n*1000).toISOString()});
 const moving=[];
 const player=createPitchPlayback((a,active)=>{if(active)moving.push(a.id);});
 player.update([play(0)]);
 const batch=Array.from({length:18},(_,i)=>play(17-i));
 player.update(batch);
 for(let i=0;i<6;i++)t.mock.timers.tick(5000);
 player.update([play(19),play(18),...batch]);
 for(let i=0;i<20;i++)t.mock.timers.tick(5000);
 assert.deepEqual(moving,Array.from({length:20},(_,i)=>String(i)));
 player.stop();
});
