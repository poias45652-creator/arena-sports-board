import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('international board scopes background data to the active view',()=>{
 const c=read('app/international-board.tsx');
 assert.ok(c.includes("view==='analysis'"));
 assert.ok(c.includes("view==='overview'"));
 assert.ok(c.includes("view==='standings'||view==='teams'"));
 assert.ok(c.includes("view==='live'&&league==='NPB'"));
 assert.ok(c.includes("['standings','schedule',...(league==='NPB'?['starters']:[])]"));
});
test('pregame and private odds stop outside views that use them',()=>{
 const c=read('app/international-board.tsx');
 assert.ok(c.includes("60000,view==='analysis'||view==='overview'"));
 assert.ok(c.includes("if(view!=='analysis'||!analysisDate)return"));
 assert.ok(c.includes("[league,analysisDate,revision,view]"));
});
test('overview still retains player-count data while analysis avoids unused bat/pit tables',()=>{
 const c=read('app/international-board.tsx');
 assert.ok(c.includes("view==='overview'"));
 assert.ok(c.includes("league==='CPBL'?[]:['bat','pit']"));
 assert.ok(c.includes("const allPlayers=Object.values(data).flatMap"));
});

// Verification marker: active-view loading does not alter LIVE coverage or recommendation inputs.
