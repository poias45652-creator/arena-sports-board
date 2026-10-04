import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
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
test('reviewed supplements fill gaps without replacing live data or crossing identities',async()=>{
 const {parseFootballRoster}=await import(moduleUrl('lib/football-team-details.ts'));
 const team={id:'384',name:'Crystal Palace',englishName:'Crystal Palace'};
 const parse=p=>parseFootballRoster({team:{id:'384',isNational:false},season:{year:2026},athletes:[p]},'eng.1','384',2026,team)[0];
 const p={id:'3123880',displayName:'Chukwunonyelum Uchenna Amobi Okoli'};
 const found=parse(p);assert.equal(found.photo,'/api/football-player-photo?player=3123880&league=eng.1');assert.equal(found.country,'England');assert.equal(found.appearances,null);assert.equal(found.goals,null);
 assert.equal(parse({...p,citizenship:'Nigeria'}).country,'Nigeria');
 assert.equal(parse({...p,displayName:'Another Player'}).country,'');
 assert.match(parse({id:'243578',displayName:'Jenson Arron Jones',dateOfBirth:'2000-10-30'}).photo,/^\/api\//);
});
test('reviewed photo sources are complete, pinned, and exclude mismatched identities',()=>{
 const sources=JSON.parse(readFileSync('data/football-reviewed-photo-sources.json'));
 const research=JSON.parse(readFileSync('docs/football-missing-player-research.json'));
 const audit=JSON.parse(readFileSync('docs/football-player-photo-audit.json'));
 assert.equal(research.players.length,181);assert.equal(Object.keys(sources).length,research.addedTransparentPhotos);
 for(const p of research.players.filter(p=>p.photo)){assert.equal(sources[p.id].sha256,p.photo.sha256);assert.equal(sources[p.id].url,p.photo.originalUrl);assert.ok(!audit.missing.some(x=>x.id===p.id));}
 assert.equal(audit.verifiedTransparentPhotos,4113+Object.keys(sources).length);
 assert.equal(audit.eligiblePlayers,audit.uniquePlayers-audit.excludedRosterRecords.length);
 assert.equal(audit.missing.length,audit.eligiblePlayers-audit.verifiedTransparentPhotos);
 assert.ok(sources['313078']);assert.ok(!sources['6841']);
});
test('reviewed PNG and WebP photos use exact bytes and MIME types; changed source images are rejected',async()=>{
 const {GET}=await import(moduleUrl('app/api/football-player-photo/route.ts'));
 const sources=JSON.parse(readFileSync('data/football-reviewed-photo-sources.json'));
 const previous=globalThis.fetch;let count=0;
 try{
  for(const [id,extension,type]of [['119332','png','image/png'],['297754','webp','image/webp']]){
   const bytes=readFileSync('tests/fixtures/football-reviewed-'+id+'.'+extension);
   globalThis.fetch=async url=>{count++;assert.equal(String(url),sources[id].url);return new Response(bytes,{headers:{'content-type':type}})};
   const response=await GET(new Request('http://localhost/api/football-player-photo?player='+id+'&league=eng.1'));
   assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),type);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  }
  globalThis.fetch=async()=>new Response(image,{headers:{'content-type':'image/png'}});
  assert.equal((await GET(new Request('http://localhost/api/football-player-photo?player=84349&league=eng.1'))).status,404);
  assert.equal(count,2);
 }finally{globalThis.fetch=previous;}
});
test('Balog cutout is served from the reviewed local asset without an external download',async()=>{
 const {GET}=await import(moduleUrl('app/api/football-player-photo/route.ts'));
 const source=JSON.parse(readFileSync('data/football-reviewed-photo-sources.json'))['408480'];
 assert.equal(source.localPath,'/images/players/football/408480-cutout.webp');
 const bytes=readFileSync('public'+source.localPath);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
 const previous=globalThis.fetch;let downloads=0;globalThis.fetch=async()=>{downloads++;throw Error('Local portrait must not download');};
 try{
  const response=await GET(new Request('http://localhost/api/football-player-photo?player=408480&league=uefa.champions'));
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);assert.equal(downloads,0);
 }finally{globalThis.fetch=previous;}
});
test('team and season identity corrections require the reviewed source fingerprint',async()=>{
 const {parseFootballRoster}=await import(moduleUrl('lib/football-team-details.ts'));
 const corrections=JSON.parse(readFileSync('data/football-roster-photo-corrections.json'));
 for(const [id,c] of Object.entries(corrections).filter(([,c])=>c.identity)){
  const p={id,displayName:c.sourceRecord.name,dateOfBirth:c.sourceRecord.birthDate,jersey:c.sourceRecord.number,citizenship:'wrong country',position:{abbreviation:'F'},statistics:{splits:{categories:[{stats:[{name:'appearances',value:5},{name:'totalGoals',value:2}]}]}}};
  const parse=(player,league=c.league,teamId=c.teamId,season=c.season)=>parseFootballRoster({team:{id:teamId,isNational:false},season:{year:season},athletes:[player]},league,teamId,season,{id:teamId,name:'test',englishName:'test'})[0];
  const result=parse(p);assert.equal(result.name,c.identity.name);assert.equal(result.country,c.identity.country);assert.equal(result.position,c.identity.position);assert.equal(result.height,c.identity.height);assert.equal(result.href,c.source);assert.equal(result.appearances,5);assert.equal(result.goals,2);
  assert.equal(result.photo,`/api/football-player-photo?player=${id}&league=${c.league}&team=${c.teamId}&season=${c.season}`);
  for(const other of [parse({...p,displayName:'Unrelated Person'}),parse({...p,dateOfBirth:'1990-01-01'}),parse({...p,jersey:'99'}),parse(p,c.league,'999'),parse(p,c.league,c.teamId,2025),parse(p,'eng.1')]){assert.equal(other.country,'wrong country');assert.ok(!other.photo.includes('&team='));}
  const repaired=parse({...p,displayName:c.identity.name,dateOfBirth:c.identity.birthDate});assert.equal(repaired.photo,result.photo);
 }
});
test('the erroneous Czechia association is excluded only with its exact fingerprint',async()=>{
 const {parseFootballRoster}=await import(moduleUrl('lib/football-team-details.ts'));
 const p={id:'6841',displayName:'David Winters',dateOfBirth:'1983-03-07',citizenship:'Scotland'};
 const parse=(player,teamId='450',season=2026)=>parseFootballRoster({team:{id:teamId,isNational:true},season:{year:season},athletes:[player]},'uefa.nations',teamId,season,{id:teamId,name:'test',englishName:'test'});
 assert.equal(parse(p).length,0);
 for(const args of [[p,'588'],[p,'450',2025],[{...p,displayName:'David Another'}],[{...p,dateOfBirth:'2000-03-07'}],[{...p,citizenship:'Czechia'}],[{...p,jersey:'10'}]])assert.equal(parse(...args).length,1);
});
test('context portraits never cross identities, including after cache population',async()=>{
 const {GET}=await import(moduleUrl('app/api/football-player-photo/route.ts'));
 const corrections=JSON.parse(readFileSync('data/football-roster-photo-corrections.json'));
 const sources=JSON.parse(readFileSync('data/football-reviewed-photo-sources.json'));
 const previous=globalThis.fetch;let downloads=0;globalThis.fetch=async()=>{downloads++;throw Error('Reviewed portraits must be local');};
 const get=q=>GET(new Request('http://localhost/api/football-player-photo?'+q));
 try{
  for(const [id,c] of Object.entries(corrections).filter(([,c])=>c.identity)){
   const prefix=`player=${id}&league=${c.league}`;
   const wrong=[prefix,prefix+`&team=999&season=2026`,prefix+`&team=${c.teamId}&season=2025`,`player=${id}&league=eng.1&team=${c.teamId}&season=2026`];
   for(const q of wrong)assert.equal((await get(q)).status,404);
   const r=await get(prefix+`&team=${c.teamId}&season=${c.season}`);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');
   const bytes=Buffer.from(await r.arrayBuffer());assert.deepEqual(bytes,readFileSync('public'+sources[id].localPath));assert.equal(createHash('sha256').update(bytes).digest('hex'),sources[id].sha256);
   for(const q of wrong)assert.equal((await get(q)).status,404);
   for(const suffix of ['&team=94','&season=2026','&team=&season=2026','&team=94&season=abc','&team=94&season=2026.5','&team=94&season=2000'])assert.equal((await get(prefix+suffix)).status,400);
  }
  assert.equal((await get('player=6841&league=uefa.nations&team=450&season=2026')).status,404);assert.equal(downloads,0);
 }finally{globalThis.fetch=previous;}
});
