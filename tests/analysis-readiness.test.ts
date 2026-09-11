import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditReadiness} from '../lib/analysis-readiness';
test('counts each game once, rejects post-start records and does not confuse completeness with validation',()=>{
 const report=(id:number,capturedAt:string,issues:string[])=>({game:{id,date:'2026-09-10T18:00:00Z'},capturedAt,issues,sources:{pinnacle:{usable:false}},context:{sides:{away:{lineupStatus:'confirmed'},home:{lineupStatus:'confirmed'}}}});
 const r=auditReadiness([report(1,'2026-09-10T16:00:00Z',['old']),report(1,'2026-09-10T17:55:00Z',[]),report(2,'2026-09-10T17:00:00Z',['weather','weather']),report(3,'2026-09-10T18:01:00Z',[])],Date.parse('2026-09-10T19:00:00Z'));
 assert.equal(r.games,2);assert.equal(r.invalidRecords,1);assert.equal(r.completeInputs,1);assert.deepEqual(r.missing,[{reason:'weather',games:1}]);assert.equal(r.leadTime.under10Minutes,1);assert.equal(r.leadTime.atLeast60Minutes,1);assert.equal(r.withPinnacle,0);assert.equal(r.modelReady,false);
});
