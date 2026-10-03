import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {normalizeFootballPhotoName,sameFootballPhotoIdentity,safeFootballPhotoUrl,validFootballPhotoBytes}=await import(moduleUrl('lib/football-photo-identity.ts'));
const image=new Uint8Array(readFileSync('tests/fixtures/football-player-photo.png'));
test('photo identities require the full name and birthday; accents may differ',()=>{
 assert.equal(normalizeFootballPhotoName('Ognjen Čančarević'),'ognjen cancarevic');
 assert.equal(sameFootballPhotoIdentity({name:'Ognjen Cancarevic',birthDate:'1989-09-25'},{name:'Ognjen Čančarević',birthDate:'1989-09-25'}),true);
 assert.equal(sameFootballPhotoIdentity({name:'John Smith',birthDate:'2000-01-01'},{name:'John Smith',birthDate:'2001-01-01'}),false);
 assert.equal(sameFootballPhotoIdentity({name:'John Smith',birthDate:''},{name:'John Smith',birthDate:''}),false);
 assert.equal(sameFootballPhotoIdentity({name:'John Smith',birthDate:'2000-01-01'},{name:'James Smith',birthDate:'2000-01-01'}),false);
});
test('portrait downloads reject arbitrary URLs, credentials, HTML, oversize bytes and giant dimensions',()=>{
 assert.equal(safeFootballPhotoUrl('https://images.fotmob.com/image_resources/playerimages/486078.png'),true);
 for(const u of ['http://images.fotmob.com/image_resources/playerimages/486078.png','https://images.fotmob.com.evil.test/image_resources/playerimages/486078.png','https://user@images.fotmob.com/image_resources/playerimages/486078.png','https://images.fotmob.com:8000/image_resources/playerimages/486078.png','https://images.fotmob.com/image_resources/playerimages/486078.png?url=http://localhost','http://127.0.0.1/private'])assert.equal(safeFootballPhotoUrl(u),false);
 assert.equal(validFootballPhotoBytes(image),true);assert.equal(validFootballPhotoBytes(new TextEncoder().encode('<html>403 Forbidden</html>')),false);
 assert.equal(validFootballPhotoBytes(new Uint8Array(1000001)),false);
 const giant=image.slice();new DataView(giant.buffer).setUint32(16,99999);assert.equal(validFootballPhotoBytes(giant),false);
});
test('the photo API serves a real PNG, caches it and rejects invalid player/league parameters',async()=>{
 const {GET}=await import(moduleUrl('app/api/football-player-photo/route.ts'));
 const previous=globalThis.fetch;let count=0;globalThis.fetch=async url=>{count++;assert.equal(String(url),'https://images.fotmob.com/image_resources/playerimages/486078.png');return new Response(image,{headers:{'content-type':'image/png'}})};
 const get=q=>GET(new Request('http://localhost/api/football-player-photo?'+q));
 try{
  for(const q of ['player=../193649&league=uefa.nations','player=193649&league=bad','player=http://localhost&league=eng.1'])assert.equal((await get(q)).status,400);
  assert.equal(count,0);const r=await get('player=193649&league=uefa.nations');assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),image);
  await get('player=193649&league=uefa.nations');assert.equal(count,1);
 }finally{globalThis.fetch=previous;}
});
test('rosters use the authenticated photo endpoint instead of assumed ESPN headshot URLs',async()=>{
 const {parseFootballRoster}=await import(moduleUrl('lib/football-team-details.ts'));
 const team={id:'579',name:'亞美尼亞',englishName:'Armenia'};
 const players=parseFootballRoster({team:{id:'579',isNational:true},season:{year:2026},athletes:[{id:'193649',displayName:'Arsen Beglaryan'}]},'uefa.nations','579',2026,team);
 assert.equal(players[0].photo,'/api/football-player-photo?player=193649&league=uefa.nations');
});
