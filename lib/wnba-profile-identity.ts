import identities from '../data/wnba-player-identities.json';
import additional from '../data/wnba-unmapped-profiles.json';
import photos from '../data/wnba-official-photos.json';
import {wnbaNameKey} from './wnba-official-players';

type Bio = {id:number; name:string; slug:string; height:string; weight:string; school:string; country:string};
const byOfficial = new Map<number, Bio & {espnId:string}>();
const byEspn = new Map<string, Bio>();
for (const bio of additional.players) byOfficial.set(bio.id, {...bio, espnId:''});
for (const [espnId, bio] of Object.entries(identities.players)) {
 byOfficial.set(bio.id, {...bio, espnId});
 byEspn.set(espnId, bio);
}
export function recordedWnbaIdentity(id:string, provider:string) {
 if (provider==='espn') return byEspn.get(id);
 return byOfficial.get(Number(id));
}
export function recordedWnbaEspnId(id:string, name:string) {
 const saved=byOfficial.get(Number(id));
 return saved && wnbaNameKey(saved.name)===wnbaNameKey(name) ? saved.espnId : '';
}
export function recordedWnbaPhoto(id:number, name:string) {
 const saved=(photos as Record<string,{name:string;url:string}>)[String(id)];
 return saved && wnbaNameKey(saved.name)===wnbaNameKey(name) ? saved.url : 'https://cdn.wnba.com/headshots/wnba/latest/1040x760/'+id+'.png';
}
