// Explicit live-source audit; not run as part of the offline unit suite.
import fs from 'node:fs/promises';
import {moduleUrl} from './profile-loader.mjs';
const {collectProfilePlayers}=await import(moduleUrl('lib/international-profile-source.ts'));
const {summarize,selectGames}=await import(moduleUrl('lib/team-profile.ts'));
const {profileTeams,profileTeamId}=await import(moduleUrl('lib/international-profile.ts'));
const jobs=Object.entries(profileTeams).flatMap(([league,teams])=>Object.keys(teams).map(code=>({league,code}))),rows=[];let next=0;
await Promise.all([0,1,2,3].map(async()=>{while(next<jobs.length){const {league,code}=jobs[next++];try{const games=JSON.parse(await fs.readFile(`.sites-runtime/profiles/${league}.json`,'utf8')).games,stats=summarize(selectGames(games,profileTeamId(league,code)),profileTeamId(league,code)),players=await collectProfilePlayers(league,code,2026);await fs.writeFile(`.sites-runtime/profiles/${league}-${code}-players.json`,JSON.stringify(players));const row={league,code,name:profileTeams[league][code],games:stats.games,wins:stats.wins,losses:stats.losses,ties:stats.ties,bat:players.bat?.rows.length||0,pit:players.pit?.rows.length||0,warnings:players.warnings};rows.push(row);console.log(JSON.stringify(row));}catch(e){rows.push({league,code,error:e.message});console.log(league,code,'FAILED',e.message)}}}));
await fs.writeFile('.sites-runtime/profiles/all-team-audit.json',JSON.stringify(rows,null,2));
if(rows.length!==28||rows.some(r=>r.error||!r.games||!r.bat||!r.pit||r.warnings.length))process.exitCode=1;
