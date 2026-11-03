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
