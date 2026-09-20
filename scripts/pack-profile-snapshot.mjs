// Package already verified public-source responses without changing their timestamps.
// Usage: node scripts/pack-profile-snapshot.mjs <audit-directory> <season>
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {moduleUrl} from '../tests/profile-loader.mjs';
const {profileTeams,profileTeamId}=await import(moduleUrl('lib/international-profile.ts'));
const [directory,yearText]=process.argv.slice(2),season=Number(yearText);
if(!directory||!Number.isInteger(season)||season<2020)throw Error('Audit directory and season required');
const read=name=>{const d=JSON.parse(readFileSync(join(directory,name),'utf8'));if(d.warnings?.length||!Number.isFinite(Date.parse(d.fetchedAt))||!d.fetchedAt.startsWith(season+'-')||!d.sources?.length)throw Error('Incomplete source: '+name);return d;};
const data={season,games:{},players:{}};
for(const league of Object.keys(profileTeams)){
 const games=read(league+'.json');if(!games.games.length||games.games.some(g=>g.season!==season))throw Error('Wrong season');
 data.games[league]=games;
 for(const code of Object.keys(profileTeams[league])){
  const p=read(`${league}-${code}-players.json`),id=profileTeamId(league,code);
  if(!p.bat?.rows.length||!p.pit?.rows.length||!games.games.some(g=>g.completed&&[g.homeId,g.awayId].includes(id)))throw Error('Incomplete team: '+league+code);
  data.players[league+':'+code]=p;
 }
}
mkdirSync('data',{recursive:true});writeFileSync(`data/international-profile-${season}.json`,JSON.stringify(data)+'\n');
console.log('Verified snapshot:',Object.keys(data.players).length,'teams; original source times preserved');
