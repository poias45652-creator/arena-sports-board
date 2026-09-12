import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

async function load(file){
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
const {parseLiveGame,mergeLiveGame}=await load('../lib/live-game.ts');
const {inningRun,playEventZh,pitchCallZh}=await load('../lib/live-display.ts');
const atBat=(index,extra={})=>({
 about:{atBatIndex:index,inning:1,halfInning:'top',isComplete:true,isScoringPlay:false},
 matchup:{batter:{id:101,fullName:'Away Batter'},pitcher:{id:202,fullName:'Home Pitcher'}},
 result:{event:'Groundout',eventType:'field_out',description:'Source play description.',awayScore:0,homeScore:0,rbi:0},
 count:{balls:1,strikes:2,outs:1},runners:[],playEvents:[],...extra,
});
const pitch=(id,extra={})=>({playId:id,index:0,isPitch:true,type:'pitch',pitchNumber:1,details:{call:{code:'C'},description:'Called Strike',type:{description:'Four-Seam Fastball'}},pitchData:{startSpeed:94.2},count:{balls:0,strikes:1,outs:0},...extra});
function fixture(plays=[]){return {
 gamePk:700001,gameData:{status:{abstractGameState:'Live',detailedState:'In Progress'},teams:{away:{id:147},home:{id:111}},datetime:{dateTime:'2026-09-12T00:00:00Z'},venue:{name:'Test Park'}},
 liveData:{linescore:{currentInning:1,isTopInning:true,inningState:'Top',scheduledInnings:9,innings:[{num:1,away:{runs:0},home:{}}],teams:{away:{runs:0,hits:0,errors:0},home:{runs:0,hits:0,errors:0}},defense:{pitcher:{id:202}},offense:{batter:{id:101}},balls:0,strikes:1,outs:0},boxscore:{teams:{away:{players:{ID101:{person:{id:101,fullName:'Away Batter'},battingOrder:'100',position:{abbreviation:'CF'},stats:{batting:{atBats:0,hits:0}}}}},home:{players:{ID202:{person:{id:202,fullName:'Home Pitcher'},stats:{pitching:{numberOfPitches:0}}}}}}},plays:{allPlays:plays,currentPlay:plays.at(-1)}},
};}

test('parses the official game snapshot without losing zero scores or zero pitches',()=>{
 const data=parseLiveGame(fixture([atBat(0)]),700001,1000);
 assert.equal(data.gamePk,700001);assert.equal(data.pitchCount,0);assert.equal(data.venue,'Test Park');
 assert.equal(data.linescore.teams.away.runs,0);assert.equal(data.plays[0].awayScore,0);
 assert.equal(data.plays[0].battingOrder,1);assert.equal(data.plays[0].position,'CF');
 assert.equal(data.fetchedAt,'1970-01-01T00:00:01.000Z');
});
test('updates an in-progress appearance once and deduplicates pitches',()=>{
 const before=atBat(0,{about:{atBatIndex:0,inning:1,halfInning:'top',isComplete:false},playEvents:[pitch('p1')]});
 const raw=fixture([before]);raw.liveData.plays.currentPlay={...before,playEvents:[pitch('p1'),pitch('p1'),pitch('p2',{index:1,pitchNumber:2})]};
 const data=parseLiveGame(raw,700001);
 assert.equal(data.plays.length,1);assert.equal(data.currentPlay.pitches.length,2);
 assert.equal(data.currentPlay.pitches[0].speed,94.2);assert.equal(data.currentPlay.bases,null);
 assert.deepEqual(data.currentPlay,data.plays[0]);
});
test('each appearance retains its own score and post-play bases, including extra innings',()=>{
 const first=atBat(0,{matchup:{batter:{id:101,fullName:'Away Batter'},pitcher:{id:202,fullName:'Home Pitcher'},postOnFirst:{id:101}},result:{event:'Single',eventType:'single',awayScore:0,homeScore:0,rbi:0}});
 const extra=atBat(72,{about:{atBatIndex:72,inning:10,halfInning:'bottom',isComplete:true,isScoringPlay:true},matchup:{batter:{id:203,fullName:'Home Batter'},pitcher:{id:102,fullName:'Away Pitcher'}},result:{event:'Home Run',eventType:'home_run',awayScore:3,homeScore:5,rbi:2}});
 const raw=fixture([extra,first]);raw.liveData.plays.currentPlay=extra;raw.liveData.linescore.teams.home.runs=5;raw.liveData.linescore.offense.third={id:204};
 const data=parseLiveGame(raw,700001);
 assert.deepEqual(data.plays.map(p=>p.index),[0,72]);
 assert.deepEqual(data.plays[0].bases,{first:true,second:false,third:false});
 assert.equal(data.plays[0].homeScore,0);assert.equal(data.plays[1].scoring,true);
 assert.equal(data.plays[1].inning,10);assert.equal(data.plays[1].half,'bottom');
 assert.deepEqual(data.plays[1].bases,{first:false,second:false,third:false});
});
test('scoring actions and pitcher substitutions remain attached to their appearance',()=>{
 const play=atBat(0,{playEvents:[{index:0,type:'action',details:{eventType:'pitching_substitution',event:'Pitching Substitution',description:'Pitcher changed.'}},{index:1,type:'action',details:{eventType:'wild_pitch',event:'Wild Pitch',description:'Runner scores.',isScoringPlay:true}}]});
 const data=parseLiveGame(fixture([play]),700001);
 assert.equal(data.plays[0].scoring,true);assert.equal(data.plays[0].actions.length,2);assert.equal(data.plays[0].pitches.length,0);
});
test('missing source information stays unknown instead of appearing as zero or empty bases',()=>{
 const play=atBat(0,{count:{},result:{},runners:undefined,playEvents:[pitch('p1',{pitchData:{startSpeed:NaN},count:{balls:-1,strikes:9,outs:null}})]});
 const raw=fixture([play]);delete raw.liveData.boxscore.teams.home.players.ID202.stats.pitching.numberOfPitches;
 const data=parseLiveGame(raw,700001);
 assert.equal(data.pitchCount,null);assert.equal(data.plays[0].awayScore,null);assert.equal(data.plays[0].bases,null);
 assert.deepEqual(data.plays[0].count,{balls:null,strikes:null,outs:null});
 assert.equal(data.plays[0].pitches[0].speed,null);assert.deepEqual(data.plays[0].pitches[0].count,{balls:null,strikes:null,outs:null});
 delete raw.liveData.plays;assert.equal(parseLiveGame(raw,700001).playsAvailable,false);
});
test('rejects mismatched games and teams so switching games cannot merge different matches',()=>{
 const raw=fixture([]);assert.throws(()=>parseLiveGame(raw,700002),/賽事編號不符/);
 const detail=parseLiveGame(raw,700001),schedule={gamePk:700001,teams:{away:{team:{id:147}},home:{team:{id:111}}}};
 const merged=mergeLiveGame(schedule,detail);assert.equal(merged.teams.away.score,0);
 assert.throws(()=>mergeLiveGame({...schedule,gamePk:700002},detail),/主客隊對應不符/);
 assert.throws(()=>mergeLiveGame({...schedule,teams:{away:{team:{id:111}},home:{team:{id:147}}}},detail),/主客隊對應不符/);
});
test('inning cells distinguish a genuine zero, unplayed innings and an unnecessary final half',()=>{
 const line=fixture().liveData.linescore;
 assert.equal(inningRun(line,'away',1,'Live'),'0');assert.equal(inningRun(line,'home',1,'Live'),'');
 assert.equal(inningRun(line,'away',2,'Live'),'');
 const final={...line,currentInning:9,teams:{away:{runs:3},home:{runs:8}}};
 assert.equal(inningRun(final,'home',9,'Final'),'X');
 assert.equal(inningRun({...final,isTopInning:false},'home',9,'Final'),'—');
 assert.equal(inningRun({...final,innings:[{num:10,home:{runs:1}}],currentInning:10,isTopInning:false},'home',10,'Final'),'1');
});
test('localizes known results without inventing a translation for an unknown source event',()=>{
 assert.equal(playEventZh('field_out','Flyout'),'高飛球出局');assert.equal(playEventZh('hit_by_pitch','Hit By Pitch'),'觸身球');
 assert.equal(playEventZh('future_event','Source Event'),'Source Event');
 assert.equal(pitchCallZh('C','Called Strike'),'看著好球');assert.equal(pitchCallZh('unknown','Source Call'),'Source Call');
});
