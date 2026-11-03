import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const {mlbRosterCardStats}=await import(moduleUrl('lib/player-card-stats.ts'));
const person={id:592450,stats:[{type:{displayName:'season'},group:{displayName:'hitting'},splits:[{season:'2026',player:{id:592450},team:{id:147},gameType:'R',stat:{avg:'.241',homeRuns:18,rbi:41}}]}]};
test('MLB roster cards retain source rates and zero, without mixing person, team, season or phase',()=>{
 const read=p=>mlbRosterCardStats(p,'RF',147,2026,'R');
 assert.deepEqual(read(person),{avg:'.241',homeRuns:18,rbi:41});
 const withSplit=change=>({...person,stats:[{...person.stats[0],splits:[{...person.stats[0].splits[0],...change}]}]});
 for(const change of [{player:{id:1}},{team:{id:111}},{season:'2025'},{gameType:'S'}])assert.equal(read(withSplit(change)),null);
 assert.equal(mlbRosterCardStats(person,'P',147,2026,'R'),null);
 assert.deepEqual(read(withSplit({stat:{homeRuns:0}})),{homeRuns:0});
 assert.equal(read({id:592450}),null);
});
