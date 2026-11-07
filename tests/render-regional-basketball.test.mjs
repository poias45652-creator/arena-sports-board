import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveEntry,snapshot} from '../server/regional-basketball/archive.mjs';
import {frontSelection,leaguePageHref} from '../lib/sport-navigation.ts';
import {scheduleLiveUntil} from '../lib/sport-live.ts';

test('regional member links and live badges retain their league and date',()=>{
  const date='2026-11-07',now=Date.parse('2026-11-07T06:30Z');
  for(const league of ['NBL','KBL']){
    assert.equal(leaguePageHref(league,'teams'),'/?league='+league+'&view=teams');
    assert.deepEqual(frontSelection('?league='+league+'&view=standings'),{league,view:'standings'});
    const feed={league,date,asOf:new Date(now-1000).toISOString(),games:[{date,status:'in_progress'}]};
    assert.ok(scheduleLiveUntil(feed,league,date,now)>now);
    assert.equal(scheduleLiveUntil(feed,league==='NBL'?'KBL':'NBL',date,now),0);
    assert.equal(scheduleLiveUntil(feed,league,date,now+120000),0);
  }
});

test('every listed player and recorded game resolves inside the correct league',async()=>{
  const catalog=await snapshot('/data/leagues.json');
  assert.deepEqual(Object.keys(catalog).sort(),['KBL','NBL']);
  for(const league of Object.keys(catalog)){
    const key=league.toLowerCase();
    const players=await snapshot('/data/'+key+'-index.json');
    const details=await snapshot('/data/'+key+'-detail-index.json');
    for(const team of catalog[league].teams)assert.ok(await archiveEntry(team.logo));
    assert.equal(catalog[league].teams.length,10);
    for(const id of Object.keys(players)){
      assert.ok(await snapshot('/data/profiles/'+key+'/'+id+'.json'),id);
      const photo=await archiveEntry('players/'+key+'/'+id+'.webp');
      assert.equal(photo?.toString('ascii',8,12),'WEBP',id);
    }
    for(const game of Object.values(details)){
      const detail=await snapshot('/data/details/'+key+'/'+game.id+'.json');
      assert.equal(detail?.home,game.home);assert.equal(detail?.away,game.away);
    }
  }
  assert.equal(await archiveEntry('../package.json'),null);
});
