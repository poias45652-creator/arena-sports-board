import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync('data/international-player-photos.json','utf8'));
const urls=[...new Set(Object.values(catalog.teams).flatMap(team=>Object.values(team).flatMap(p=>[p.url,...p.alternatives||[]])))];
const results=new Map();let cursor=0;
await Promise.all(Array.from({length:8},async()=>{while(cursor<urls.length){const url=urls[cursor++];try{const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'YJBaseballStats/1.0'}});const ok=r.ok&&/^image\//.test(r.headers.get('content-type')||'');await r.body?.cancel();results.set(url,ok);}catch{results.set(url,false);}}}));
let missing=0;
for(const [team,players]of Object.entries(catalog.teams)){let ok=0;const unavailable=[];for(const [name,p]of Object.entries(players)){if([p.url,...p.alternatives||[]].some(u=>results.get(u)))ok++;else unavailable.push(name);}console.log(JSON.stringify({team,reachable:ok,total:Object.keys(players).length,unavailable}));missing+=unavailable.length;}
console.log(JSON.stringify({uniqueImageUrls:urls.length,reachable:[...results.values()].filter(Boolean).length,playersWithoutReachableSource:missing}));
