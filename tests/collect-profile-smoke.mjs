import fs from 'node:fs/promises';
import {moduleUrl} from './profile-loader.mjs';
const {collectProfileGames,collectProfilePlayers}=await import(moduleUrl('lib/international-profile-source.ts'));
const {summarize,selectGames}=await import(moduleUrl('lib/team-profile.ts'));
const {profileTeamId}=await import(moduleUrl('lib/international-profile.ts'));
await fs.mkdir('.sites-runtime/profiles',{recursive:true});
await Promise.all(['CPBL','NPB','KBO'].map(async league=>{const code={CPBL:'ACN',NPB:'d',KBO:'KT'}[league];try{const data=await collectProfileGames(league,2026);await fs.writeFile(`.sites-runtime/profiles/${league}.json`,JSON.stringify(data));console.log(league,data.games.length,data.warnings,summarize(selectGames(data.games,profileTeamId(league,code)),profileTeamId(league,code)));}catch(e){console.log(league,'FAILED',e.message)}try{const players=await collectProfilePlayers(league,code,2026);await fs.writeFile(`.sites-runtime/profiles/${league}-players.json`,JSON.stringify(players));console.log(league,'players',players.bat?.rows.length,players.pit?.rows.length,players.warnings);}catch(e){console.log(league,'PLAYERS FAILED',e.message)}}));
