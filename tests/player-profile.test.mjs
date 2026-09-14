import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true}});
after(()=>vite.close());
const {playerLink,parsePlayerQuery,parsePlayerBio,playerStatLines,playerTotal}=await vite.ssrLoadModule('/lib/player-profile.ts');
const {default:PlayerLink}=await vite.ssrLoadModule('/app/player-link.tsx');
const {GET}=await vite.ssrLoadModule('/app/api/player/route.ts');
const current=new Date().getUTCFullYear();
const split=(id,extra={})=>({season:String(current),sport:{id:1},gameType:'R',player:{id},stat:{era:'0.00',whip:'1.05',inningsPitched:'12.2',strikeOuts:0},...extra});
const block=(group,type,splits)=>({group:{displayName:group},type:{displayName:type},splits});

test('names link to the exact MLB player and selected year, while unknown players stay plain text',()=>{
  assert.equal(playerLink(695380,2025,'R'),'/players/695380?season=2025&type=R');
  for(const id of [null,undefined,0,-1,NaN,Infinity,1.5])assert.equal(playerLink(id),null);
  const html=renderToStaticMarkup(React.createElement(PlayerLink,{id:695380,season:2025},'Alex Hoppe'));
  assert.match(html,/href="\/players\/695380\?season=2025"/);assert.match(html,/>Alex Hoppe<\/a>/);
  assert.equal(renderToStaticMarkup(React.createElement(PlayerLink,{id:null},'先發待公布')),'先發待公布');
});

test('player and filter validation rejects malformed and out-of-range inputs',()=>{
  assert.deepEqual(parsePlayerQuery('695380','2025','R',2026),{id:695380,season:2025,gameType:'R'});
  for(const id of ['-1','0','1e3','../../admin','695380.0'])assert.equal(parsePlayerQuery(id,null,null),null);
  assert.equal(parsePlayerQuery('695380',String(current+1),'R'),null);
  assert.equal(parsePlayerQuery('695380','2025','invalid'),null);
  assert.equal(parsePlayerQuery('695380','all','R'),null);
});

test('statistics keep real zeros and baseball innings while rejecting wrong players, seasons, leagues and duplicate rows',()=>{
  const valid=split(695380,{date:`${current}-09-12`,game:{gamePk:1},opponent:{id:147,name:'Yankees'},isHome:true});
  const json={stats:[block('pitching','gameLog',[valid,valid,split(1),split(695380,{sport:{id:11}}),split(695380,{season:'2021'}),split(695380,{gameType:'S'})]),block('hitting','gameLog',[split(695380)])]};
  const rows=playerStatLines(json,695380,'pitching','gameLog','R',current);
  assert.equal(rows.length,1);assert.equal(rows[0].stat.era,'0.00');assert.equal(rows[0].stat.inningsPitched,'12.2');assert.equal(rows[0].stat.strikeOuts,0);assert.equal(rows[0].stat.baseOnBalls,null);assert.equal(rows[0].opponent.id,147);
});

test('a traded player uses MLB combined totals instead of summing or averaging team rates',()=>{
  const first={team:{id:110},stat:{era:'1.00',inningsPitched:'10.1'}},second={team:{id:147},stat:{era:'3.00',inningsPitched:'15.2'}},total={team:null,stat:{era:'2.42',inningsPitched:'26.0'}};
  assert.deepEqual(playerTotal([first,second,total]),total.stat);
  assert.equal(playerTotal([first,second]),null);
});

test('bio is matched by ID and does not invent missing ages, teams or debut dates',()=>{
  assert.equal(parsePlayerBio({people:[{id:1,fullName:'Other'}]},695380),null);
  const bio=parsePlayerBio({people:[{id:695380,fullName:'Alex Hoppe',primaryPosition:{abbreviation:'P'},primaryNumber:'26'}]},695380);
  assert.equal(bio.name,'Alex Hoppe');assert.equal(bio.age,null);assert.equal(bio.team,null);assert.equal(bio.debut,null);
});

test('API returns pitching, hitting, career and game logs for the requested MLB player and filters',async()=>{
  const original=globalThis.fetch,calls=[],id=910001;
  globalThis.fetch=async input=>{
    const url=new URL(String(input));calls.push(url);
    if(url.pathname.endsWith('/stats')){
      const history=url.searchParams.get('stats').includes('yearByYear');
      return Response.json({stats:history?[block('pitching','career',[split(id)]),block('pitching','yearByYear',[split(id)])]:[block('pitching','season',[split(id)]),block('pitching','gameLog',[split(id,{date:`${current}-09-12`,game:{gamePk:12}})]),block('hitting','season',[split(id,{stat:{avg:'.250',hits:1}})])]});
    }
    return Response.json({people:[{id,fullName:'Test Player',primaryPosition:{abbreviation:'TWP'}}]});
  };
  try{
    const response=await GET(new Request(`https://site.test/api/player?id=${id}&season=${current}&type=R`)),data=await response.json();
    assert.equal(response.status,200);assert.equal(data.player.id,id);assert.equal(data.groups.pitching.season.inningsPitched,'12.2');assert.equal(data.groups.hitting.season.avg,'.250');assert.equal(data.groups.pitching.games.length,1);assert.equal(data.groups.pitching.history.length,1);assert.deepEqual(data.warnings,[]);
    assert.equal(calls.length,3);assert.ok(calls.every(url=>url.hostname==='statsapi.mlb.com'));
    assert.ok(calls.filter(url=>url.pathname.endsWith('/stats')).every(url=>url.searchParams.get('sportIds')==='1'&&url.searchParams.get('gameType')==='R'));
  }finally{globalThis.fetch=original;}
});

test('a failed statistics request keeps the player bio and an explicit unavailable state; invalid IDs never reach MLB',async()=>{
  const original=globalThis.fetch,id=910002;let calls=0;
  globalThis.fetch=async input=>{calls++;return String(input).includes('/stats?')?new Response('',{status:503}):Response.json({people:[{id,fullName:'Test Player'}]});};
  try{
    const response=await GET(new Request(`https://site.test/api/player?id=${id}`)),data=await response.json();
    assert.equal(response.status,200);assert.equal(data.player.id,id);assert.equal(data.groups.pitching.season,null);assert.equal(data.groups.pitching.career,null);assert.equal(data.warnings.length,2);
    const before=calls;assert.equal((await GET(new Request('https://site.test/api/player?id=-1'))).status,400);assert.equal(calls,before);
  }finally{globalThis.fetch=original;}
});
