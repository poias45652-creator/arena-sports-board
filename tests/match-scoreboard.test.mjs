import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=ts.transpileModule(readFileSync(new URL('../lib/match-scoreboard.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {matchScore,showMatchScoreboard}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const day='2026-09-13';
const game={id:900001,date:'2026-09-12T17:00:00Z',state:'Preview',away:{id:121},home:{id:147}};
const raw={gamePk:game.id,status:{abstractGameState:'Live'},teams:{away:{team:{id:121},score:0},home:{team:{id:147},score:0}},linescore:{currentInning:1,innings:[{num:1,away:{runs:0}}],teams:{away:{runs:0,hits:0,errors:0},home:{runs:0,hits:0,errors:0}}}};
const snapshot=(games=[raw])=>({date:day,fetchedAt:'2026-09-12T17:01:00Z',games});

test('scheduled time and pregame zero scores do not display a scoreboard',()=>{
 const preview={...raw,status:{abstractGameState:'Preview',detailedState:'Warmup'}};
 const score=matchScore(game,snapshot([preview]),day);
 assert.equal(score,null);
 assert.equal(showMatchScoreboard({...game,date:'2020-01-01T00:00:00Z'},score),false);
});
test('the official live update opens the board and preserves actual zero scores',()=>{
 const score=matchScore(game,snapshot(),day);
 assert.equal(score,raw);
 assert.equal(showMatchScoreboard(game,score),true);
 assert.equal(score.linescore.teams.away.runs,0);
 assert.equal(showMatchScoreboard({...game,state:'Live'},null),true);
});
test('date switches, different games, reversed teams and duplicate matches cannot show another score',()=>{
 assert.equal(matchScore(game,{...snapshot(),date:'2026-09-12'},day),null);
 assert.equal(matchScore(game,snapshot([{...raw,gamePk:900002}]),day),null);
 assert.equal(matchScore(game,snapshot([{...raw,teams:{away:raw.teams.home,home:raw.teams.away}}]),day),null);
 assert.equal(matchScore(game,snapshot([raw,raw]),day),null);
});
test('finished matches retain the board without regressing to an older live snapshot',()=>{
 const final={...game,state:'Final'};
 assert.equal(showMatchScoreboard(final,null),true);
 assert.equal(matchScore(final,snapshot(),day),null);
 const score={...raw,status:{abstractGameState:'Final'}};
 assert.equal(matchScore(final,snapshot([score]),day),score);
});
