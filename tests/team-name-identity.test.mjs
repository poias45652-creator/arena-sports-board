import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const identity=await import(moduleUrl('lib/team-name-identity.ts'));
const names=await import(moduleUrl('lib/sport-team-names.ts'));
const markets=await import(moduleUrl('lib/sport-super-markets.ts'));
const football=await import(moduleUrl('lib/football.ts'));
const mlb=await import(moduleUrl('lib/mlb-team-names.ts'));
const international=await import(moduleUrl('lib/international-teams.ts'));
const {baseballSourceAudit}=await import(moduleUrl('lib/baseball-source-audit.ts'));
const {footballTeamNameAudit}=await import(moduleUrl('lib/football-team-name-audit.ts'));
const capture=JSON.parse(fs.readFileSync('tests/fixtures/super-name-pairing-20261026.json'));
const history=JSON.parse(fs.readFileSync('tests/fixtures/super-name-audit-20261026.json'));
const expected=[
 ['401876428','6997','2502','布雷斯特','尼斯',25125169],
 ['401882830','101','3751','巴列卡諾','埃爾切',25128377],
 ['401874961','2572','3997','科莫','薩索洛',25128386],
 ['401884756','122','133','科隆','沙爾克04',25128392],
 ['401882831','87','88','桑坦德競技','西班牙人',25128406],
 ['401874980','3997','112','薩索洛','拉齊奧',25138344],
];
// Independently retrieved schedules contain the eventual final state for old
// games. Explicitly replay their pregame state at the production capture time.
// All quotes below are synthetic; no live prices are stored in the fixture.
function replay(row,offset=0){
 const schedule=structuredClone(row.schedule),event=schedule.events[0],competition=event.competitions[0];
 event.date=competition.date=new Date(Date.parse(competition.date)+offset).toISOString();
 competition.status={type:{name:'STATUS_SCHEDULED',state:'pre',completed:false}};
 const game=football.parseFootballEvents(schedule,row.fixture.competition)[0];
 const now=Date.parse(row.capturedAt)+offset;
 const source={...row.fixture,league:'FOOTBALL',start:new Date(Date.parse(game.start)+8*3600000).toISOString().slice(0,19).replaceAll('-','/').replace('T',' '),displayMarkets:[
  {period:'full',type:101,quotes:[{primary:true,open:true,homeLine:'0.5',awayLine:'',homePrice:.9,awayPrice:.95}]},
  {period:'full',type:102,quotes:[{primary:true,open:true,total:'2.5',over:.9,under:.95}]},
  {period:'full',type:110,quotes:[{primary:true,open:true,homePrice:1.8,awayPrice:2.1,drawPrice:2.5}]},
 ]};
 // Preserve the actual source kickoff for historical replay (do not derive it
 // from the schedule under test); only future simulations shift both clocks.
 if(offset===0)source.start=row.fixture.start;
 return {game,now,snapshot:{source:'test-only',fetchedAt:new Date(now).toISOString(),sportGames:[source]}};
}

test('six observed SUPER fixtures join independent ESPN identities with all full markets',()=>{
 capture.cases.forEach((row,i)=>{
  const {game,now,snapshot}=replay(row),want=expected[i];
  assert.deepEqual([game.id,game.home.id,game.away.id,game.home.name,game.away.name],want.slice(0,5));
  assert.ok(Date.parse(game.start)>now);
  const result=markets.sportMarketStatus(snapshot,game,'FOOTBALL',now);
  assert.equal(result.code,'matched');assert.equal(result.event.id,want[5]);assert.equal(result.availableCount,3);
  assert.deepEqual(markets.sportSourceAudit(snapshot,now).unrecognizedTeamNames,[]);
 });
});

test('verified aliases work on future dates without fixture IDs or date-specific overrides',()=>{
 for(const row of capture.cases)for(const days of [7,365,730]){
  const {game,now,snapshot}=replay(row,days*86400000);
  game.id='999999999';snapshot.sportGames[0].id=777777777;
  assert.equal(markets.matchSportEvent(snapshot,game,'FOOTBALL',now)?.id,777777777);
 }
});

test('758 historical warnings are covered except the genuinely unsupported London Lions',()=>{
 assert.equal(history.observedLogCount,758);assert.equal(history.names.length,43);
 const unknown=history.names.filter(r=>!names.registeredNames[r.sport].has(names.sportTeamKey(r.name,r.sport)));
 assert.deepEqual(unknown.map(({sport,name})=>({sport,name})),[{sport:'NBA',name:'倫敦雄獅'}]);
});

test('new aliases retain league, orientation, youth, time, freshness and duplicate guards',()=>{
 for(const row of capture.cases){
  const {game,now,snapshot}=replay(row);
  for(const suffix of [' U21',' Women','(女)','預備隊','二隊',' B',' II']){
   const s=structuredClone(snapshot);s.sportGames[0].away+=suffix;
   assert.equal(markets.matchSportEvent(s,game,'FOOTBALL',now),null,suffix);
  }
  for(const patch of [{home:game.away,away:game.home},{away:{name:'其他球隊'}},{league:'fifa.friendly'},{start:new Date(Date.parse(game.start)+86400000).toISOString()}]){
   assert.equal(markets.matchSportEvent(snapshot,{...game,...patch},'FOOTBALL',now),null);
  }
  assert.equal(markets.matchSportEvent(snapshot,game,'FOOTBALL',now+150000),null);
  snapshot.sportGames.push({...snapshot.sportGames[0],id:8888888});
  assert.equal(markets.matchSportEvent(snapshot,game,'FOOTBALL',now),null);
 }
 for(const alias of ['奈斯','艾爾切','薩斯索羅','史浩克04','桑坦德'])for(const sport of ['NBA','WNBA'])assert.equal(names.sportTeamKey(alias,sport),alias);
});

test('format normalization preserves identities across every registered sport and baseball league',()=>{
 const decorated=name=>' '+name.split('').join('　')+'（主） ';
 for(const [sport,registered] of Object.entries(names.registeredNames))for(const name of registered)assert.equal(names.sportTeamKey(decorated(name),sport),name);
 for(const name of Object.values(mlb.MLB_TEAM_NAMES))assert.equal(mlb.mlbTeamName(decorated(name)),name);
 for(const [league,teams] of Object.entries(international.internationalTeams))for(const name of Object.values(teams))assert.equal(international.internationalTeam(decorated(name),league),name);
 assert.equal(football.footballTeamName(' ｆｃ　ｃｏｌｏｇｎｅ '),'科隆');
 assert.equal(football.footballTeamName('atletico madrid'),'馬德里競技');
 assert.equal(international.internationalTeam('ｋｔ　巫師（ＫＢＯ）（主）','KBO'),'KT 巫師');
 assert.equal(names.sportTeamKey('金州女武神（女）（主）','WNBA'),'金州女武神');
});

test('official name changes use reviewed ESPN IDs without guessing unknown IDs or squad identities',()=>{
 assert.equal(football.footballTeamName('Changed official label','122'),'科隆');
 assert.equal(football.footballTeamName('Changed official label','3997'),'薩索洛');
 assert.equal(football.footballTeamName('Changed official label','999999999'),'Changed official label');
 for(const name of ['FC Cologne U21','FC CologneU21','FC Cologne Women','FC CologneWomen','科隆青年隊','科隆二隊','FC Cologne B','FC Cologne II'])assert.equal(football.footballTeamName(name,'122'),name);
 const row=structuredClone(capture.cases[3]);
 row.schedule.events[0].competitions[0].competitors[0].team.displayName='Changed official label';
 assert.equal(replay(row).game.home.name,'科隆');
});

test('exact registries reject colliding aliases and preserve cross-league distinctions',()=>{
 const resolve=identity.teamNameResolver([['Same Team','甲隊'],['ＳＡＭＥ　ＴＥＡＭ','乙隊'],['Same Team','甲隊']]);
 assert.equal(resolve('same team'),null);assert.equal(resolve('__proto__'),null);
 assert.equal(resolve('甲隊'),'甲隊');assert.equal(resolve('乙隊'),'乙隊');
 assert.notEqual(identity.teamNameKey('Club U21'),identity.teamNameKey('Club'));
 assert.notEqual(identity.teamNameKey('Club G1'),identity.teamNameKey('Club G2'));
 assert.equal(international.internationalTeam('Tigers','NPB'),'阪神虎');
 assert.equal(international.internationalTeam('tigers','KBO'),'起亞虎');
 assert.equal(international.internationalTeam('Tigers','CPBL'),'Tigers');
 assert.equal(international.internationalTeam('Giants','NPB'),'讀賣巨人');
 assert.equal(international.internationalTeam('Giants','KBO'),'樂天巨人');
 assert.equal(international.internationalTeam('Rakuten','KBO'),'Rakuten');
 assert.equal(international.internationalTeam('阪神(KBO)','NPB'),'阪神(KBO)');
});

test('source audits inspect rows beyond the output cap and emit no prices or account fields',()=>{
 const {snapshot,now}=replay(capture.cases[0]);
 snapshot.sportGames=Array.from({length:121},(_,i)=>({...snapshot.sportGames[0],id:i}));
 snapshot.sportGames[120].away='未登錄新球隊';
 const sport=markets.sportSourceAudit(snapshot,now);
 assert.equal(sport.fixtures.length,120);assert.equal(sport.fixtureCount,121);
 assert.deepEqual(sport.unrecognizedTeamNames,[{sport:'FOOTBALL',name:'未登錄新球隊'}]);
 const baseball={token:'DO_NOT_LOG',games:Array.from({length:121},()=>({home:'紐約洋基G1(主)',away:'波士頓紅襪G1',memberId:'PRIVATE_MEMBER',homePrice:.91})),internationalGames:[{league:'KBO',home:'ＫＴ巫師(主)',away:'SSG登陸者'},{league:'__proto__',home:'bad',away:'bad'}]};
 baseball.games[120].away='新隊名';
 const audit=baseballSourceAudit(baseball);
 assert.equal(audit.fixtureCount,122);assert.deepEqual(audit.unrecognizedTeamNames,[{sport:'MLB',name:'新隊名'}]);
 assert.ok(!/DO_NOT_LOG|PRIVATE_MEMBER|homePrice/.test(JSON.stringify(audit)));
 const many=baseballSourceAudit({games:Array.from({length:121},(_,i)=>({home:'unknown'+i,away:'紐約洋基'}))});
 assert.equal(many.unrecognizedTeamNameCount,121);assert.equal(many.unrecognizedTeamNames.length,120);assert.equal(many.unrecognizedTeamNamesTruncated,true);
 const game=replay(capture.cases[0]).game,games=Array.from({length:121},()=>structuredClone(game));
 games[120].away={id:'999',name:'Unknown official team'};
 assert.deepEqual(footballTeamNameAudit(games).teams,[{league:'fra.1',id:'999',name:'Unknown official team'}]);
});
