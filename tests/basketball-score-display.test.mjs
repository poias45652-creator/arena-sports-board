import test from 'node:test';import assert from 'node:assert/strict';import {moduleUrl} from './profile-loader.mjs';
const {basketballScoreDisplay:display}=await import(moduleUrl('lib/basketball-score-display.ts'));
test('88:88 rounding collision selects projected winner and reconciles totals',()=>{const r=display({away:88.4,home:88},{away:.515,home:.485});assert.ok(r.away>r.home);assert.equal(r.total,r.home+r.away);assert.equal(r.margin,r.home-r.away);});
test('home winner, unchanged separated scores, and genuinely level uncertainty',()=>{assert.ok(display({home:110.4,away:110.1},{home:.51,away:.49}).margin>0);assert.deepEqual(display({home:112.9,away:109.6},{home:.6,away:.4}),{home:113,away:110,total:223,margin:3});assert.equal(display({home:88,away:88},{home:.5,away:.5}),null);});
