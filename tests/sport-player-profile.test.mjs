import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const b=await import(moduleUrl('lib/basketball-player-profile.ts')), f=await import(moduleUrl('lib/football-player-profile.ts')), shared=await import(moduleUrl('lib/sport-player-profile.ts')), parse=await import(moduleUrl('lib/sport-player-fetch.ts'));
const fixture=name=>JSON.parse(readFileSync(`tests/fixtures/player-profiles/${name}.json`));
test('provider player IDs remain separate; identity mapping requires exact name and birthday',()=>{
 assert.equal(shared.basketballPlayerHref('NBA',{id:203083}),'/players/nba/203083');
 assert.equal(shared.basketballPlayerHref('WNBA',{id:4433403,officialId:1642286}),'/players/wnba/1642286');
 assert.equal(shared.basketballPlayerHref('WNBA',{id:1642286,href:'https://www.wnba.com/player/1642286/caitlin-clark'}),'/players/wnba/1642286');
 assert.equal(shared.basketballPlayerHref('WNBA',{id:4433403}),'/players/wnba/4433403?provider=espn');
 const source={id:'6585',displayName:'Andre Drummond',dateOfBirth:'1993-08-10T00:00Z'},expected={name:'Andre Drummond',birthDate:'1993-08-10'};
 assert.equal(b.verifiedBasketballIdentity(source,expected),true);
 for(const patch of [{birthDate:''},{birthDate:'1993-08-11'},{name:'Another Player'}])assert.equal(b.verifiedBasketballIdentity(source,{...expected,...patch}),false);
});
test('actual NBA history keeps all team stints and rejects another league or phase',()=>{
 const raw=fixture('nbaStatsEspn'), rows=b.basketballPlayerHistory(raw,'NBA','2');
 assert.equal(rows[0].season,2026);assert.equal(rows[0].values.avgRebounds,'8.4');assert.ok(rows.length>=14);
 assert.throws(()=>b.basketballPlayerHistory(raw,'WNBA','2'));assert.throws(()=>b.basketballPlayerHistory(raw,'NBA','3'));
});
test('actual NBA game log filters season and phase before rendering; zero is not missing',()=>{
 const raw=fixture('nbaGames'), regular=b.basketballPlayerGames(raw,'NBA',2026,'2'), post=b.basketballPlayerGames(raw,'NBA',2026,'3'), pre=b.basketballPlayerGames(raw,'NBA',2026,'1');
 assert.equal(regular.length,63);assert.ok(post.length>0&&pre.length>0);assert.ok(regular.every(r=>r.competition==='例行賽'));assert.ok(post.every(r=>r.competition==='季後賽'));assert.throws(()=>b.basketballPlayerGames(raw,'NBA',2025,'2'));
 assert.deepEqual(shared.namedValues(['a','b','c','d'],[0,null,'0','DNP']),{a:'0',b:'—',c:'0',d:'—'});assert.deepEqual(shared.namedValues(['a'],[]),{});
});
test('football historical statistics reject mismatched identity, team and competition',()=>{
 const raw=fixture('soccerTypedStats'),p=f.footballPlayerHistory(raw,'250787','uefa.champions','382');assert.ok(p.rows.length>5);assert.ok(p.columns.some(([k,l])=>k==='G'&&l==='進球'));
 assert.throws(()=>f.footballPlayerHistory(raw,'9','uefa.champions','382'));assert.throws(()=>f.footballPlayerHistory(raw,'250787','eng.1','382'));assert.throws(()=>f.footballPlayerHistory(raw,'250787','uefa.champions','359'));
});
test('football match page retains the selected competition instead of the mixed common API log',()=>{
 const raw=fixture('soccerMatches'),p=f.footballPlayerGames(raw,'250787','eng.1','382',2026);assert.equal(p.rows.length,4);assert.ok(p.rows.every(r=>/^(勝|負|和) /.test(r.result)));assert.ok(p.columns.some(([k,l])=>k==='A'&&l==='助攻'));
 assert.throws(()=>f.footballPlayerGames(raw,'250787','uefa.champions','382',2026));assert.throws(()=>f.footballPlayerGames(raw,'250787','eng.1','382',2025));
 const duplicate=structuredClone(raw);duplicate.gmlog.groups.push(...raw.gmlog.groups);assert.equal(f.footballPlayerGames(duplicate,'250787','eng.1','382',2026).rows.length,4);
 const html='<script>window[\'__espnfitt__\']='+JSON.stringify({page:{content:{player:raw}}})+';</script>';assert.equal(parse.espnPagePlayer(html,'250787').playerId,'250787');assert.throws(()=>parse.espnPagePlayer(html,'123'));
});
test('all three real-source profiles have bio, Chinese column labels and populated statistics',()=>{
 for(const name of ['nba','wnba','football']){const p=fixture(name+'-profile');assert.ok(p.bio.length>=4&&p.history.length&&p.games.length);assert.ok(p.columns.every(c=>/[\u4e00-\u9fff]/.test(c[1])));assert.deepEqual(p.warnings,[]);assert.ok(p.team.href.startsWith('/teams/'));}
 assert.equal(shared.playerPosition('Forward-Center'),'前鋒／中鋒');assert.equal(shared.playerCountry('England'),'英格蘭');
});
test('a rookie without official season statistics keeps a valid current year, never year 1',async()=>{
 const native=globalThis.fetch;
 globalThis.fetch=async input=>new Response('<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:String(input).endsWith('/players')?{players:[{PERSON_ID:9990001,PLAYER_SLUG:'test-rookie'}]}:{player:{info:{PERSON_ID:9990001,DISPLAY_FIRST_LAST:'Test Rookie'},gameLogs:[]}}}})+'</script>');
 try{const p=await b.basketballPlayerProfile('9990001','NBA');assert.equal(p.season,new Date().getUTCFullYear());assert.deepEqual(p.summary,{});assert.ok(p.seasons.every(y=>y>=1947));}finally{globalThis.fetch=native;}
});

test('Suns roster cards and profiles survive an unavailable NBA directory and player page',async t=>{
 const leagueTeam=1610612756,season='2026';
 const row=(id,name,birthday)=>({TeamID:leagueTeam,SEASON:season,PLAYER_ID:id,PLAYER:name,BIRTH_DATE:birthday,NUM:'0',POSITION:'F'});
 const roster=[row(1642346,'Ryan Dunn','JAN 07, 2003'),row(1631166,'Drew Timme','SEP 09, 2000'),row(1628415,'Dillon Brooks','JAN 22, 1996')];
 const athlete=(id,name,birthday)=>({id,uid:'s:40~l:46~a:'+id,displayName:name,dateOfBirth:birthday+'T08:00Z'});
 const athletes=[athlete('4888725','Ryan Dunn','2003-01-07'),athlete('4431695','Drew Timme','2000-09-09'),athlete('3155526','Dillon Brooks','1996-02-22')];
 const metric=(name,value)=>({name,value});
 const statistics=[{stats:[metric('gamesPlayed',6),metric('avgPoints',4.333),metric('avgRebounds',3.667),metric('avgAssists',0)]}];
 const leaders=athletes.filter(p=>p.displayName!=='Drew Timme').map(athlete=>({athlete,statistics}));
 const team={id:'21'},clock={year:2027,type:2};
 t.mock.method(globalThis,'fetch',async input=>{
  const u=new URL(input);
  if(u.pathname==='/team/1610612756/suns')return new Response('<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{team:{id:leagueTeam,info:{TEAM_ID:leagueTeam},roster}}}})+'</script>');
  if(u.pathname.endsWith('/21/roster'))return Response.json({team,season:clock,athletes});
  if(u.pathname.endsWith('/21/athletes/statistics')&&u.searchParams.get('season')==='2027'&&u.searchParams.get('seasontype')==='2')return Response.json({team,season:clock,results:[{name:'game',leaders}]});
  if(u.pathname.endsWith('/4888725/stats'))return Response.json({filters:[{name:'league',value:'nba'},{name:'seasontype',value:'2'}],categories:[{name:'averages',names:['avgPoints','avgRebounds','avgAssists'],statistics:[{season:{year:2027},teamId:21,stats:['4.3','3.7','0.0']}]}]});
  return new Response('',{status:403});
 });
 const official=await import(moduleUrl('lib/nba-official.ts'));
 const result=await official.officialTeamProfile('21');
 const [dunn,timme,brooks]=result.roster;
 assert.deepEqual(dunn.averages,{season:2027,points:4.3,rebounds:3.7,assists:0});
 assert.equal(timme.averages,undefined);assert.equal(timme.seasonStatsEmpty,true);
 assert.equal(brooks.averages,undefined);assert.equal(brooks.seasonStatsEmpty,false,'birthday mismatch cannot confirm missing stats');
 assert.equal(shared.basketballPlayerHref('NBA',dunn,'21'),'/players/nba/1642346?team=21&season=2027');
 const data=await b.basketballPlayerProfile('1642346','NBA',2027,'2','official','21');
 assert.equal(data.name,'Ryan Dunn');assert.equal(data.id,'1642346');assert.equal(data.team.href,'/teams/nba/21');
 assert.deepEqual(data.summary,{avgPoints:'4.3',avgRebounds:'3.7',avgAssists:'0.0'});
 await assert.rejects(()=>b.basketballPlayerProfile('9990011','NBA',2027,'2','official','21'));
 const older=await b.basketballPlayerProfile('1642346','NBA',2026,'2','official','21');
 assert.deepEqual(older.summary,{});
});

test('WNBA trade summaries prefer the season total and preserve individual team rows',async t=>{
 const names=['avgPoints','avgRebounds','avgAssists'];
 const season={year:2026,displayName:'2026'};
 const statistics=[
  {season,teamId:'20',teamSlug:'atlanta-dream',stats:['0.7','0.2','0.1']},
  {season,teamId:'6',teamSlug:'los-angeles-sparks',stats:['6.0','3.0','1.0']},
  {season,teamSlug:'2026 Totals',stats:['1.0','0.3','0.2']},
 ];
 const raw={filters:[{name:'league',value:'wnba'},{name:'seasontype',value:'2'}],categories:[{name:'averages',names,statistics}]};
 t.mock.method(globalThis,'fetch',async input=>{
  const path=new URL(input).pathname;
  if(path.endsWith('/stats'))return Response.json(raw);
  if(path.endsWith('/4597509'))return Response.json({athlete:{id:'4597509',displayName:'Aaliyah Nye',team:{id:'6'}}});
  return new Response('',{status:404});
 });
 const p=await b.basketballPlayerProfile('4597509','WNBA',2026,'2','espn');
 assert.deepEqual(p.summary,{avgPoints:'1.0',avgRebounds:'0.3',avgAssists:'0.2'});
 assert.match(p.summaryLabel,/合計$/);
 assert.equal(p.history.find(r=>r.team==='洛杉磯火花').values.avgPoints,'6.0');
 statistics[2]={season,teamSlug:'unknown',stats:['9','9','9']};
 assert.ok(!b.basketballPlayerHistory(raw,'WNBA','2').some(r=>r.team==='合計'));
});

test('a WNBA roster link opens its season even when the last player stats are from a prior year',async t=>{
 const raw=JSON.parse(readFileSync('tests/fixtures/wnba/official-players.json','utf8'));
 const id=1630387, player={id,season:'2026',href:'https://www.wnba.com/player/1630387/iliana-rupert'};
 const url=shared.basketballPlayerHref('WNBA',player);
 assert.equal(url,'/players/wnba/1630387?season=2026');
 assert.equal(shared.basketballPlayerHref('WNBA',{id:4790263,season:'2026'}),'/players/wnba/4790263?provider=espn&season=2026');
 t.mock.method(globalThis,'fetch',async input=>{
  const path=new URL(input).pathname;
  const html=data=>new Response('<script id="__NEXT_DATA__">'+JSON.stringify(data)+'</script>');
  if(path==='/players')return html(raw);
  if(path.endsWith('/iliana-rupert'))return html({props:{pageProps:{player:{pid:id,info:{PERSON_ID:id,DISPLAY_FIRST_LAST:'Iliana Rupert'},stats:{TimeFrame:'2025',PTS:9.3,REB:3.9,AST:1.6}}}}});
  return new Response('',{status:404});
 });
 for(const year of [2026,undefined]){
  const p=await b.basketballPlayerProfile(String(id),'WNBA',year);
  assert.equal(p.season,2026);assert.deepEqual(p.summary,{});
 }
 const previous=await b.basketballPlayerProfile(String(id),'WNBA',2025);
 assert.equal(previous.summary.avgPoints,'9.3');
});

test('league season totals keep official IDs separate, preserve a real zero and reject ambiguous splits',async()=>{
 const stats=await import(moduleUrl('lib/basketball-season-totals.ts'));
 const url=stats.basketballSeasonUrl('WNBA',2026),parameters=Object.fromEntries(url.searchParams);
 const table={name:'LeagueDashPlayerStats',headers:['PLAYER_ID','GP','PTS','REB','AST'],rowSet:[
  [1642876,1,4,4,2],[1641807,1,0,2,1],[1628269,40,6.4,4.5,1.8],[1628269,4,4.3,2.3,1.8],
 ]};
 const raw={resource:'leaguedashplayerstats',parameters,resultSets:[table]};
 const index=stats.parseBasketballSeason(raw,url);
 assert.equal(stats.playerSeasonResult(index,1641807).line.points,0);
 assert.deepEqual(stats.playerSeasonResult(index,1628269),{line:null,missing:false});
 assert.deepEqual(stats.playerSeasonResult(index,9876543),{line:null,missing:true});
 assert.deepEqual(stats.playerSeasonResult(null,9876543),{line:null,missing:false});
 for(const params of [{Season:'2025'},{LeagueID:'00'},{SeasonType:'Pre Season'},{TeamID:1611661324},{LastNGames:1}]){
  assert.throws(()=>stats.parseBasketballSeason({...raw,parameters:{...parameters,...params}},url));
 }
 assert.throws(()=>stats.parseBasketballSeason({...raw,resultSets:[{...table,rowSet:[]}]},url));
});

test('NBA official whole-season totals reach card and profile with stale ESPN, isolated by year and phase',async t=>{
 const id=9912345,tid=1610612740,year=2024;
 const team={id:tid,info:{TEAM_ID:tid},roster:[{TeamID:tid,SEASON:'2023',PLAYER_ID:id,PLAYER:'Test Player',BIRTH_DATE:'SEP 09, 2000'}]};
 const html=data=>new Response('<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:data}})+'</script>');
 t.mock.method(globalThis,'fetch',async input=>{
  const u=new URL(input);
  if(u.pathname==='/team/1610612740/pelicans')return html({team});
  if(u.pathname==='/player/'+id)return html({player:{info:{PERSON_ID:id,TEAM_ID:tid,DISPLAY_FIRST_LAST:'Test Player',BIRTHDATE:'2000-09-09'},roster:team.roster,stats:{PLAYER_ID:id,TimeFrame:'2022-23',PTS:9,REB:1,AST:8}}});
  if(u.hostname==='stats.nba.com'&&u.searchParams.get('Season')==='2023-24')
   return Response.json({resource:'leaguedashplayerstats',parameters:Object.fromEntries(u.searchParams),resultSets:[{name:'LeagueDashPlayerStats',headers:['PLAYER_ID','GP','PTS','REB','AST'],rowSet:[[id,1,0,2,1]]}]});
  return new Response('',{status:404});
 });
 const official=await import(moduleUrl('lib/nba-official.ts'));
 const roster=await official.officialTeamProfile('3');
 assert.deepEqual(roster.roster[0].averages,{season:year,points:0,rebounds:2,assists:1});
 const p=await b.basketballPlayerProfile(String(id),'NBA');
 assert.equal(p.season,year);assert.equal(p.summary.avgPoints,'0');assert.equal(p.summary.avgRebounds,'2');assert.equal(p.summary.avgAssists,'1');
 assert.equal(p.history.find(r=>r.season===year).team,'合計');
 const archive=await b.basketballPlayerProfile(String(id),'NBA',2023);
 assert.equal(archive.summary.avgPoints,'9');
 const pre=await b.basketballPlayerProfile(String(id),'NBA',year,'1');assert.deepEqual(pre.summary,{});
});

test('a basketball search hit must match the professional league, identity and birthday before reading ESPN history',async t=>{
 const names=['Test Prospect A','Test Prospect B','Test Prospect C'],ids=['9987101','9987102','9987103'];
 const lookedUp=[];
 const html=player=>new Response('<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{player}}})+'</script>');
 t.mock.method(globalThis,'fetch',async input=>{
  const u=new URL(input),id=u.pathname.split('/').at(-1);
  if(u.hostname==='www.nba.com'&&ids.includes(id))return html({info:{PERSON_ID:Number(id),DISPLAY_FIRST_LAST:names[ids.indexOf(id)],BIRTHDATE:'2000-05-17'}});
  if(u.pathname==='/apis/search/v2'){
   const name=u.searchParams.get('query'),i=names.indexOf(name);
   return Response.json({results:[{type:'player',contents:[{uid:'s:40~l:69~a:'+ids[i],displayName:name}]}]});
  }
  if(u.hostname==='sports.core.api.espn.com'){
   const i=ids.indexOf(id);return Response.json({uid:`s:40~l:${i===2?'69':'46'}~a:${id}`,id,displayName:names[i],dateOfBirth:i===1?'2000-05-18':'2000-05-17'});
  }
  if(u.pathname.endsWith('/stats'))lookedUp.push(u.pathname.split('/').at(-2));
  return new Response('',{status:404});
 });
 for(const id of ids)await b.basketballPlayerProfile(id,'NBA',2024,'1');
 assert.deepEqual(lookedUp,[ids[0]]);
});
