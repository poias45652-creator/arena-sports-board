import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
// Applied AFTER the verified v127 archive is restored. Never replace the site.
const path=resolve(import.meta.dirname,'app/international-board.tsx');
const text=await readFile(path,'utf8');
const line="import InternationalLiveFeed from './international-live-feed';\n";
const target="{league==='KBO'?kboSchedule:schedulePanel}";
const replacement="<InternationalLiveFeed key={league} league={league} revision={revision}/>{league==='KBO'?kboSchedule:schedulePanel}";
if(!text.includes(line)){
 if(createHash('sha256').update(text).digest('hex')!=='928fa9871b5fb8076d89ccbbfd8a7384fccd73bb570e3307a7c8afe64ee51f83')throw new Error('International board changed; review the live-feed patch before building.');
 if(text.split(target).length!==2)throw new Error('Expected one live panel insertion point');
 const updated=text.replace("import {useEffect,useState}",line+"import {useEffect,useState}").replace(target,replacement);
 if(!updated.includes(line)||!updated.includes(replacement))throw new Error('Live-feed insertion failed');
 await writeFile(path,updated);
}
console.log('YJ: current baseball feed connected; existing login, admin and history preserved.');
