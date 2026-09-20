import archive from '@/data/international-profile-2026.json';
import {collectProfileGames} from './international-profile-source';
import type {KboRunHistory} from './kbo-team-runs';

let cached:KboRunHistory=archive.games.KBO as KboRunHistory;
let until=0,pending:Promise<KboRunHistory>|null=null;
export async function getKboRunHistory():Promise<KboRunHistory>{
 if(until>Date.now())return cached;
 if(!pending)pending=collectProfileGames('KBO',new Date().getUTCFullYear()).then(value=>{
  if(value.warnings.length)throw Error('Incomplete KBO history');
  cached=value;until=Date.now()+3600000;return value;
 }).catch(()=>{until=Date.now()+60000;return cached;}).finally(()=>{pending=null;});
 // Keep the request bounded; a failed refresh retains the original archive time.
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([pending,new Promise<KboRunHistory>(resolve=>{timer=setTimeout(()=>resolve(cached),20000);})]);}
 finally{if(timer)clearTimeout(timer);}
}
