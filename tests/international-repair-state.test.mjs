import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverKboPregameState} from '../server/baseball-pregame-state.mjs';
const fixture=()=>({league:'KBO',status:'unknown',rawStatus:'READY',startTime:'2026-09-22T09:30:00Z',source:{fetchedAt:'2026-09-22T09:02:00Z'},away:{score:null},home:{score:null}});
test('KBO actual READY lineup phase retains eligibility only before verified first pitch',()=>{assert.equal(recoverKboPregameState(fixture()).status,'pregame');});
test('KBO recovery preserves live, final, cancellation and non-KBO states',()=>{for(const status of ['live','final','cancelled','postponed','suspended'])assert.equal(recoverKboPregameState({...fixture(),status}).status,status);assert.equal(recoverKboPregameState({...fixture(),league:'CPBL'}).status,'unknown');});
test('KBO unknown clocks, post-start observations and conflicting scores are not pregame',()=>{for(const change of [{startTime:null},{source:{fetchedAt:'invalid'}},{source:{fetchedAt:'2026-09-22T09:30:00Z'}},{source:{fetchedAt:'2026-09-22T10:30:00Z'}},{away:{score:1}},{rawStatus:'UNRECOGNIZED'}])assert.equal(recoverKboPregameState({...fixture(),...change}).status,'unknown');});
