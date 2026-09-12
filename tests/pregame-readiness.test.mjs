import assert from 'node:assert/strict';
import test, {after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true}});
after(()=>vite.close());
const {winnerReadiness,marketContextStatus}=await vite.ssrLoadModule('/lib/pregame-readiness.ts');
const {assembleAnalysis}=await vite.ssrLoadModule('/lib/pregame-analysis.ts');
const {resolveOfficialLineup}=await vite.ssrLoadModule('/lib/lineup-authority.ts');
const {baseProbability}=await vite.ssrLoadModule('/lib/baseball.ts');
await vite.ssrLoadModule('/tests/pregame-analysis.test.ts');

const now=Date.parse('2026-09-12T10:00:00Z'),stamp=new Date(now).toISOString();
const game={id:823170,date:'2026-09-12T20:05:00Z',season:2026,gameType:'R',state:'Preview',status:'Scheduled',startTimeTBD:false,
  away:{id:135,name:'San Diego Padres',wins:79,losses:68,pitcherId:650633,pitcherName:'Michael King'},
  home:{id:137,name:'San Francisco Giants',wins:62,losses:86,pitcherId:702885,pitcherName:'Cesar Perdomo'}};
const row=(id,name,teamId=null)=>({id:String(id),name,teamId,attempts:100,hardHit:35,barrelPa:5});
function sources(){
  const snapshot=(kind,rows)=>({error:'',data:{kind,year:2026,fetchedAt:stamp,source:'fixture',rows}});
  return {pitchers:snapshot('pitcher',[row(650633,'King, Michael'),row(702885,'Perdomo, Cesar')]),
    batting:snapshot('batter-team',[row(135,'SD',135),row(137,'SF',137)]),
    pitching:snapshot('pitcher-team',[row(135,'SD',135),row(137,'SF',137)])};
}
function analysisInput(){
  const wrap=data=>({source:'fixture',fetchedAt:stamp,...data});
  const side=which=>({teamId:game[which].id,status:'confirmed',pitcher:game[which].pitcherName,players:[]});
  return {lineups:wrap({games:[{dateET:'2026-09-12',timeET:'4:05 PM ET',away:side('away'),home:side('home'),dome:false}]}),
    'roster-135':wrap({players:[{id:650633,name:'Michael King',throws:'R'}]}),
    'roster-137':wrap({players:[{id:702885,name:'Cesar Perdomo',throws:'L'}]}),
    'fg-injuries':wrap({year:2026,rows:[]}),
    runs:wrap({year:2026,league:4.5,rows:[{id:135,scored:640,allowed:590,batGames:147,pitchGames:147},{id:137,scored:610,allowed:660,batGames:148,pitchGames:148}]})};
}

test('a known starter without Statcast remains selectable using the same record-based probability, with a named warning',()=>{
  const data=sources(),p=baseProbability(game);
  assert.equal(winnerReadiness(game,true,now,data).advancedReady,true);
  data.pitchers.data.rows.pop();
  const result=winnerReadiness(game,true,now,data);
  assert.equal(result.blocked,'');assert.equal(result.advancedReady,false);
  assert.match(result.warnings.join('；'),/Cesar Perdomo.*尚無本季進階資料/);
  assert.doesNotMatch(result.warnings.join('；'),/先發.*未公布/);
  assert.equal(baseProbability(game),p);assert.equal(data.pitchers.data.rows.length,1);
});

test('small samples, missing metrics, failed, stale and wrong-season sources stay explicit instead of becoming complete data',()=>{
  const data=sources();data.pitchers.data.rows[1].attempts=12;
  let result=winnerReadiness(game,true,now,data);
  assert.equal(result.blocked,'');assert.match(result.warnings.join('；'),/Cesar Perdomo.*12.*50/);
  data.pitchers.data.rows[1].attempts=50;data.pitchers.data.rows[1].barrelPa=null;
  assert.match(winnerReadiness(game,true,now,data).warnings.join('；'),/缺少優質擊球率/);
  for(const mutate of [s=>{s.error='failed';},s=>{s.data.fetchedAt='2026-09-11T10:00:00Z';},s=>{s.data.year=2025;}]){
    const data=sources();mutate(data.pitchers);result=winnerReadiness(game,true,now,data);
    assert.equal(result.blocked,'');assert.equal(result.advancedReady,false);assert.ok(result.warnings.length);
  }
});

test('missing official starters, invalid records, stale schedules and started or cancelled games remain blocked',()=>{
  assert.match(winnerReadiness(game,false,now,sources()).blocked,/賽程/);
  for(const mutate of [g=>{g.home.pitcherId=null;},g=>{g.away.wins=1;g.away.losses=1;},g=>{g.state='Live';},g=>{g.status='Cancelled';},g=>{g.date=stamp;},g=>{g.startTimeTBD=true;}]){
    const changed=structuredClone(game);mutate(changed);
    assert.ok(winnerReadiness(changed,true,now,sources()).blocked);
  }
});

test('a different secondary starter quarantines the entire lineup while official starter and baseline estimates remain unchanged',()=>{
  const input=analysisInput(),original=assembleAnalysis(game,input,now);
  input.lineups.games[0].away.pitcher='Different Pitcher';
  const report=assembleAnalysis(game,input,now),status=marketContextStatus(game,report,now);
  assert.equal(report.game.away.pitcherId,650633);
  assert.equal(report.context.lineupResolution.secondaryLineupExcluded,true);
  assert.equal(report.sources.lineups.usable,false);
  assert.deepEqual(report.context.sides.away.lineup,[]);assert.deepEqual(report.context.sides.home.lineup,[]);
  assert.equal(report.features.away_lineup_wrc_plus,null);
  assert.equal(report.candidate.status,'waiting_data');assert.equal(report.candidate.probabilities,null);
  assert.deepEqual(report.baseline,original.baseline);
  assert.equal(status.blocked,'');assert.match(status.notice,/MLB 官方 Michael King/);
});

test('injury conflicts on the official starter remain blocking even when another source has been excluded',()=>{
  const input=analysisInput();input.lineups.games[0].away.pitcher='Different Pitcher';
  input['fg-injuries'].rows=[{teamId:137,playerId:702885,activeInjury:true,returnDate:null}];
  const status=marketContextStatus(game,assembleAnalysis(game,input,now),now);
  assert.match(status.blocked,/主隊.*傷兵.*暫停本場推薦/);assert.ok(status.notice);
});

test('old, wrong-game and superseded-starter reports cannot provide a current conflict decision or notice',()=>{
  const input=analysisInput();input.lineups.games[0].away.pitcher='Different Pitcher';
  const report=assembleAnalysis(game,input,now);
  for(const mutate of [r=>{r.capturedAt='2026-09-11T10:00:00Z';},r=>{r.game.id++;},r=>{r.game.date='2026-09-13T20:05:00Z';},r=>{r.game.home.pitcherId++;}]){
    const changed=structuredClone(report);mutate(changed);
    assert.deepEqual(marketContextStatus(game,changed,now),{blocked:'',notice:''});
  }
});

test('accent and punctuation differences retain a matching lineup without fuzzy matching different starters',()=>{
  const candidate=analysisInput().lineups.games[0];candidate.home.pitcher='César Perdomo';
  assert.equal(resolveOfficialLineup(game,candidate).lineup,candidate);
  candidate.home.pitcher='C. Perdomo';assert.equal(resolveOfficialLineup(game,candidate).lineup,null);
});
