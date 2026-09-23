import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const {playerPhotoKey,withPlayerPhotos}=await import(moduleUrl('lib/international-player-photos.ts'));
test('normalizes handedness markers, compatible Japanese letters and English name order',()=>{
 for(const [a,b]of [['* 伊原 陵人','伊原　陵人'],['+ 植田 海','植田 海'],['#許基宏','許基宏'],['Hyun-soo Kim','KIM Hyun Soo'],['Lewin Díaz','DIAZ Lewin'],['伊藤 大海','伊藤 大海']])assert.equal(playerPhotoKey(a),playerPhotoKey(b));
 assert.notEqual(playerPhotoKey('Kim Min Soo'),playerPhotoKey('Kim Hyun Soo'));
});
test('verified photos survive statistics outages without changing statistics or crossing teams/seasons',()=>{
 const raw={status:'stale',fetchedAt:'2026-09-19',bat:{rows:[['石黒 佑弥','12'],['+ 植田 海','3']]},pit:null};
 const out=withPlayerPhotos(raw,'NPB','t',2026);assert.match(out.photos['石黒 佑弥'],/^https:\/\//);assert.ok(out.photos['+ 植田 海']);assert.equal(out.bat,raw.bat);assert.equal(out.fetchedAt,raw.fetchedAt);assert.equal(out.status,'stale');assert.equal(raw.photos,undefined);
 assert.equal(withPlayerPhotos(raw,'NPB','t',2027),raw);assert.deepEqual(withPlayerPhotos(raw,'NPB','g',2026).photos,{});assert.deepEqual(withPlayerPhotos(raw,'MLB','t',2026).photos,{});
});
