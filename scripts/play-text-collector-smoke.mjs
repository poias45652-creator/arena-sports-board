import assert from 'node:assert/strict';
import {collectLeague} from '../server/baseball-current.mjs';
const league=process.argv[2],feed=await collectLeague(league,{date:'2026-09-22'});
const report={league,checkedAt:new Date().toISOString(),errors:feed.errors,games:feed.games.map(g=>({id:g.id,status:g.status,away:g.away.name,home:g.home.name,textStatus:g.playText?.status,events:g.playText?.records?.length||0,halves:[...new Set((g.playText?.records||[]).map(r=>r.inning+':'+r.half))],missing:g.playText?.missingInnings,reason:g.playText?.reason}))};
console.log('COLLECTOR_TEXT',JSON.stringify(report));
assert.ok(feed.games.length,'real dated fixtures must survive enrichment');
if(league!=='CPBL')assert.ok(feed.games.filter(g=>g.status==='final').every(g=>g.playText?.records?.length>25),'completed NPB/KBO fixtures require actual narrative events');
if(league==='CPBL')assert.ok(feed.games.every(g=>g.playText?.status==='unavailable'),'empty Yahoo playByPlay is not synthesized');
