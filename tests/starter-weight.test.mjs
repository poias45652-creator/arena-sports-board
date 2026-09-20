import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';

const {multifactorWin}=await import(moduleUrl('lib/multifactor-win.ts'));
const {buildRunAnalysis,inningRunRate,matchingRunAnalysis,analysisFixtureKey,MODEL_VERSION}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const {NPB_MODEL_VERSION}=await import(moduleUrl('lib/npb-analysis.ts'));
const {pregameImportsByLeague}=await import(moduleUrl('lib/pregame-imports.ts'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const json=p=>JSON.parse(readFileSync(p,'utf8'));

test('MLB starter differences contribute exactly 60% of the factor budget',()=>{
 const now=Date.parse('2026-09-13T12:00:00Z');
 const side=id=>({id,wins:70,losses:70,pitcherId:id+100,pitcherEra:4,pitcherWhip:1.3});
 const game={id:1,date:'2026-09-14T00:00:00Z',season:2026,home:side(1),away:side(2)};
 const report={game,capturedAt:new Date(now).toISOString(),features:{home_starter_recent_era:4,away_starter_recent_era:4},issues:[],context:{sides:{home:{lineupStatus:'confirmed'},away:{lineupStatus:'confirmed'}}}};
 near(multifactorWin(game,report,now).homeWin,.5);
 game.home.pitcherEra=0; // full +1 ERA score
 game.home.pitcherWhip=.5; // full +1 WHIP score
 report.features.home_starter_recent_era=0; // full +1 recent ERA score
 const r=multifactorWin(game,report,now);
 near(r.homeWin,.8); // baseline .5 + .60 / 2; never a +60 percentage-point bonus
 near(r.factors.filter(f=>f.name.startsWith('先發')).reduce((n,f)=>n+f.weight,0),60);
 near(r.factors.filter(f=>!f.name.startsWith('先發')).reduce((n,f)=>n+f.weight,0),40);
 near(r.factors.find(f=>f.name==='本季戰績').weight,20*2/3);
 near(r.factors.find(f=>f.name==='牛棚近三日用球數').weight,7*2/3);
 // Unknown ERA must contribute nothing; it is not assigned to the remaining factors.
 game.home.pitcherEra=null;
 const missing=multifactorWin(game,report,now);
 near(missing.homeWin,.65);
 assert.equal(missing.factors.find(f=>f.name==='先發本季 ERA').score,null);
 assert.equal(missing.ready,false);
});

test('regulation rates use starter 60%, offense 20%, defense 10%, bullpen 10% without innings dilution',()=>{
 const bat={offense:4},pit={starterEra:4,defense:4,bullpenEra:4,starterInnings:3};
 const total=(b,p)=>Array.from({length:9},(_,i)=>inningRunRate(b,p,i+1)).reduce((n,x)=>n+x,0);
 near(total(bat,pit),4);
 near(total(bat,{...pit,starterEra:5})-total(bat,pit),.6);
 near(total({...bat,offense:5},pit)-total(bat,pit),.2);
 near(total(bat,{...pit,defense:5})-total(bat,pit),.1);
 near(total(bat,{...pit,bullpenEra:5})-total(bat,pit),.1);
 near(total(bat,{...pit,starterInnings:7}),total(bat,pit));
 for(const inning of [10,11,12]){
  near(inningRunRate(bat,{...pit,starterEra:9},inning),4/9);
  near(inningRunRate({...bat,offense:6},{...pit,defense:2,bullpenEra:8},inning),(6*.5+2*.25+8*.25)/9);
 }
});

for(const [league,game,now,oldVersion] of [
 ['NPB',json('data/npb-pregame-20260920.json').games[3],Date.parse('2026-09-20T04:00:00Z'),'npb-runs-poisson-v1'],
 ['KBO',json('data/kbo-pregame-20260920.json').games[0],Date.parse('2026-09-20T04:00:00Z'),'kbo-runs-poisson-v1'],
 ['CPBL',pregameImportsByLeague.CPBL.games[2],Date.parse('2026-09-20T06:00:00Z'),'cpbl-game-logs-poisson-v2'],
])test(`${league} actual forecast uses new coefficients and rejects forecasts from the old model`,()=>{
 const r=buildRunAnalysis(game,now,league);
 assert.equal(r.status,'ready',r.reason);
 assert.equal(r.version,MODEL_VERSION[league]);
 for(const [side,other] of [['away','home'],['home','away']]){
  const bat=r.inputs[side],pit=r.inputs[other];
  near(r.expected[side],.6*pit.starterEra+.2*bat.offense+.1*pit.defense+.1*pit.bullpenEra);
 }
 near(r.win.home+r.win.away+r.win.draw,1);
 const previous={...r,version:oldVersion};
 assert.equal(matchingRunAnalysis(r.fixture,new Map([[analysisFixtureKey(r.fixture,league),previous]]),now,league),null);
 if(league==='NPB')assert.equal(NPB_MODEL_VERSION,r.version);
});
