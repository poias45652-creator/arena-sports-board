import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {moduleUrl} from './profile-loader.mjs';
const football=JSON.parse(readFileSync('data/football-player-photo-refresh.json','utf8'));
const cpbl=JSON.parse(readFileSync('data/international-player-photo-refresh.json','utf8'));
const {withPlayerPhotos}=await import(moduleUrl('lib/international-player-photos.ts'));
const hash=url=>createHash('sha256').update(readFileSync('public'+url)).digest('hex');
test('new football portraits preserve audited original bytes, including both missing Bayern keepers',()=>{
 assert.ok(Object.keys(football).length>=91);
 assert.equal(football['409827'].name,'Jannis Bärtl');
 assert.equal(football['3110056'].name,'David Podar-Stiube');
 for(const p of Object.values(football)){
  assert.equal(hash(p.photo.localPath),p.photo.sha256);
  assert.ok(p.name);assert.match(p.photo.url,/^https:\/\//);
 }
});
test('CPBL refresh keeps original photo bytes and isolates named players by team and season',()=>{
 for(const [key,players]of Object.entries(cpbl.teams))for(const [name,p]of Object.entries(players)){
  assert.equal(hash(p.url),p.sha256);assert.match(p.source,/^https:\/\/www\.cpbl\.com\.tw\/team\/person\?Acnt=\d+$/);
  const raw={bat:{rows:[[name,'0']]},photos:{}};const data=withPlayerPhotos(raw,'CPBL',key.split(':')[1],2026);
  assert.equal(data.photos[name],p.url);assert.equal(data.bat,raw.bat);assert.equal(withPlayerPhotos(raw,'CPBL',key.split(':')[1],2025),raw);
 }
 const raw={bat:{rows:[['張閔勛','0']]},photos:{}};
 assert.equal(withPlayerPhotos(raw,'CPBL','AJL',2026).photos['張閔勛'],cpbl.teams['CPBL:AJL']['張閔勛'].url);
 assert.equal(withPlayerPhotos(raw,'CPBL','AAA',2026).photos['張閔勛'],undefined);
 assert.doesNotMatch(JSON.stringify(withPlayerPhotos(raw,'CPBL','AJL',2026).photoAlternatives),/flag|FISU/i);
});

test('all newly reviewed baseball portraits survive an empty source and replace logos and silhouettes',()=>{
 const checked=JSON.parse(readFileSync('data/international-reviewed-roster-portraits.json'));
 for(const [team,portraits] of Object.entries(checked.teams)){
  const [league,code]=team.split(':');
  for(const p of portraits){
   const raw={bat:{rows:[[p.name,'0']]},photos:{[p.name]:'/old-placeholder.jpg'}};
   const out=withPlayerPhotos(raw,league,code,checked.season);
   assert.equal(out.photos[p.name],p.localPath);
   assert.deepEqual(out.photoAlternatives[p.name],[p.localPath,p.sourceUrl]);
   assert.equal(hash(p.localPath),p.sha256);
   assert.equal(out.photoSources[p.name],p.profileUrl);
   assert.equal(withPlayerPhotos(raw,league,code,checked.season-1),raw);
   assert.equal(withPlayerPhotos(raw,league,'other-club',checked.season).photos[p.name],'/old-placeholder.jpg');
  }
 }
});

test('a disputed portrait is withheld and national-team-only portraits cannot escape their reviewed context',async()=>{
 const {GET}=await import(moduleUrl('app/api/football-player-photo/route.ts'));
 const {footballPhotoUrl}=await import(moduleUrl('lib/football-photo-policy.ts'));
 const get=q=>GET(new Request('http://localhost/api/football-player-photo?'+q));
 const policy=JSON.parse(readFileSync('data/football-photo-policy.json'));
 const previous=globalThis.fetch;
 try{
  globalThis.fetch=async()=>{throw Error('these identities must not fall back to an external photo');};
  for(const id of policy.pending){
   assert.equal(footballPhotoUrl(id,'uefa.europa','20024',2026,{displayName:'Harutyun Asatryan'},true),'');
   assert.equal((await get(`player=${id}&league=uefa.europa&team=20024&season=2026`)).status,404);
   assert.equal((await get(`player=${id}&league=uefa.europa`)).status,404);
  }
  for(const [id,scopes] of Object.entries(policy.scoped))for(const s of scopes){
   const player={displayName:s.name,position:{abbreviation:s.position}};
   const prefix=`player=${id}&league=${s.league}`,suffix=`&team=${s.team}&season=${s.season}`;
   assert.equal(footballPhotoUrl(id,s.league,s.team,s.season,player,false),'/api/football-player-photo?'+prefix+suffix);
   assert.equal(footballPhotoUrl(id,s.league,s.team,s.season,{...player,displayName:'Unrelated player'},false),'');
   assert.equal(footballPhotoUrl(id,s.league,s.team,s.season,{...player,position:{abbreviation:'other'}},false),'');
   assert.equal((await get(prefix+suffix)).status,200);
   for(const wrong of [prefix,prefix+'&team=99999&season='+s.season,prefix+'&team='+s.team+'&season=2025'])
    assert.equal((await get(wrong)).status,404);
  }
 }finally{globalThis.fetch=previous;}
});

test('Levante number 24 receives his verified portrait only for the reviewed 2026 roster fingerprint',async()=>{
 const {parseFootballRoster}=await import(moduleUrl('lib/football-team-details.ts'));
 const source={id:'339195',displayName:'Thiago Fernandez',dateOfBirth:'2007-07-08T07:00Z',jersey:'24',citizenship:'Paraguay',position:{abbreviation:'D'}};
 const parse=(p,team='1538')=>parseFootballRoster({team:{id:team,isNational:false},season:{year:2026},athletes:[p]},'esp.1',team,2026,{id:team,name:'測試隊',englishName:'test'})[0];
 assert.match(parse(source).photo,/&team=1538&season=2026$/);
 assert.equal(parse(source).country,'Argentina');
 assert.equal(parse({...source,jersey:'31'}).country,'Paraguay');
 for(const edit of [{position:{abbreviation:'M'}},{dateOfBirth:'2004-04-04'},{citizenship:'Uruguay'},{jersey:'31'}])
  assert.doesNotMatch(parse({...source,...edit}).photo,/&team=/);
 assert.doesNotMatch(parse(source,'999').photo,/&team=/);
});

test('Levante profile verifies its roster when the global ID belongs to Libertad',async()=>{
 const {footballPlayerProfile}=await import(moduleUrl('lib/football-player-profile.ts'));
 const row={id:'339195',displayName:'Thiago Fernandez',dateOfBirth:'2007-07-08T07:00Z',citizenship:'Paraguay',jersey:'24',position:{abbreviation:'D'}};
 const previous=globalThis.fetch;
 try{
  globalThis.fetch=async url=>{
   if(String(url).includes('/athletes/339195'))return Response.json({athlete:{...row,jersey:'31',team:{id:'3713',displayName:'Libertad'}}});
   if(String(url).includes('/teams/1538/roster'))return Response.json({team:{id:'1538',displayName:'Levante'},season:{year:2026},athletes:[row]});
   throw Error('A different club player’s statistics cannot be reused');
  };
  const player=await footballPlayerProfile('339195','esp.1',2026,'1538');
  assert.match(player.photo,/team=1538&season=2026$/);assert.equal(player.number,'24');
  assert.equal(player.bio[0][1],'2004-04-03');assert.equal(player.team.href,'/teams/football/esp.1/1538');
  assert.deepEqual(player.history,[]);assert.deepEqual(player.games,[]);
 }finally{globalThis.fetch=previous;}
});
