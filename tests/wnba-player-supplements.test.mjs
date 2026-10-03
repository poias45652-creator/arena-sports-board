import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {parseOfficialWnbaDirectory}=await import(moduleUrl('lib/wnba-official.ts'));
const row=(id,first,last)=>[id,last,first,`${first}-${last}`.toLowerCase().replace(/[^a-z-]/g,''),'','sky','Chicago','Sky','','1','G','','','Kentucky','',2026,0,0,1,0,2026,0,2,3,'Season'];
const directory=r=>({props:{pageProps:{defaultSeason:2026,currentPlayersData:[r,...Array.from({length:99},(_,i)=>row(i+1,'Fixture','Player'))]}}});
const parse=r=>parseOfficialWnbaDirectory(directory(r)).players[0];
test('verified WNBA bio fills omissions while preserving official measurements and averages',()=>{
 const m=row(1643439,'Tonie','Morgan');const p=parse(m);
 assert.equal(p.height,'5-9');assert.equal(p.country,'');assert.equal(p.weight,'');
 assert.deepEqual(p.averages,{season:2026,points:0,rebounds:2,assists:3});
 m[11]='5-10';assert.equal(parse(m).height,'5-10');
 const t=row(1642804,'Te-Hina','Paopao');assert.equal(parse(t).country,'USA');t[14]='Official country';assert.equal(parse(t).country,'Official country');
 assert.equal(parse(row(1643458,'Saylor','Poffenbarger')).country,'USA');
});
test('photo and bio supplements require both league ID and full player name',()=>{
 assert.match(parse(row(1643825,'Elena','Buenavida')).photo,/valenciabasket/);
 assert.match(parse(row(1642835,'Morgan','Maly')).photo,/1642835-cutout\.png$/);
 const gueye=parse(row(1643832,'Aminata','Gueye'));assert.ok(existsSync('public'+gueye.photo));
 const wrong=parse(row(1643825,'Other','Player'));assert.match(wrong.photo,/\/1643825\.png$/);assert.equal(wrong.photoFallback,'');
 assert.equal(parse(row(1643439,'Other','Player')).height,'');
});
test('photo replacements and historical bios never supply WNBA season performance',()=>{
 const r=row(1642835,'Morgan','Maly');r[20]=2025;assert.equal(parse(r).averages,null);
 r[20]=2026;r[24]='Career';assert.equal(parse(r).averages,null);
});
