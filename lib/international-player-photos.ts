import catalog from '@/data/international-player-photos.json';
import refreshed from '@/data/international-player-photo-refresh.json';
import reviewed from '@/data/international-reviewed-roster-portraits.json';
import {playerPhotoKey,type NpbPlayerLinks} from './international-profile-links';
export {playerPhotoKey} from './international-profile-links';
type RosterPortrait = {name:string;localPath:string;sourceUrl:string;profileUrl:string};
const rosterPortraits = new Map(Object.entries(reviewed.teams).map(([team, rows]) =>
  [team, new Map((rows as RosterPortrait[]).map(p => [playerPhotoKey(p.name), p]))]
));
// NPB handedness markers are not part of a name. English name order and hyphens
// vary between FanGraphs and KBO; never compare names across different teams.
export function npbCatalogPlayer(name:string,code:string){
 const entry=(catalog.teams as Record<string,Record<string,{url:string;source:string;alternatives?:string[]}>>)[`NPB:${code}`]?.[playerPhotoKey(name)];
 if(!entry)return null;
 const urls=[entry.url,...entry.alternatives||[]];
 const id=urls.map(url=>url.match(/^https:\/\/sports-baseball\.west\.edge\.storage-yahoo\.jp\/npb\/images\/player\/(?:portrait|square)\/\d+\/([1-9]\d{3,8})\.jpg$/)?.[1]).find(Boolean);
 const verified=reviewed.season===catalog.season?rosterPortraits.get(`NPB:${code}`)?.get(playerPhotoKey(name)):undefined;
 return {id,photoUrls:verified?[verified.localPath,verified.sourceUrl]:[...new Set(urls)],reviewed:!!verified};
}
/** Send only verified IDs to the analysis board, keeping the photo catalog server-side. */
export function npbProfileLinks(year:number):NpbPlayerLinks{
 if(year!==catalog.season)return {};
 return Object.fromEntries(Object.entries(catalog.teams).filter(([team])=>team.startsWith('NPB:')).map(([team,players])=>{
  const code=team.slice(4);
  return [code,Object.fromEntries(Object.keys(players).flatMap(name=>{
   const id=npbCatalogPlayer(name,code)?.id;
   return id?[[name,id]]:[];
  }))];
 }));
}
export function withPlayerPhotos(data:any,league:string,code:string,year:number){
 if(year!==catalog.season)return data;
 const refresh=year===refreshed.season?(refreshed.teams as Record<string,Record<string,{url:string;source:string;originalUrl?:string;number?:string}>>)[`${league}:${code}`]:undefined;
 const checked=year===reviewed.season?rosterPortraits.get(`${league}:${code}`):undefined;
 let usesCheckedPhoto=false;
 const team={...((catalog.teams as Record<string,Record<string,{url:string;source:string;alternatives?:string[]}>>)[`${league}:${code}`]||{}),...Object.fromEntries(Object.entries(refresh||{}).map(([name,p])=>[playerPhotoKey(name),{...p,alternatives:p.originalUrl?[p.originalUrl]:[]}]))};
 const photos={...(data.photos||{})},photoAlternatives:Record<string,string[]>={},photoSources:Record<string,string>={},playerLinks:Record<string,string>={};
 for(const table of [data.bat,data.pit])for(const row of table?.rows||[]){const key=playerPhotoKey(row[0]),verified=checked?.get(key);
  if(verified){
   photos[row[0]]=verified.localPath;
   photoAlternatives[row[0]]=[verified.localPath,verified.sourceUrl];
   photoSources[row[0]]=verified.profileUrl;
   usesCheckedPhoto=true;
   continue;
  }
  const entry=team[key];if(!entry)continue;const urls=[entry.url,...entry.alternatives||[],photos[row[0]]].filter(Boolean);photos[row[0]]=urls[0];photoAlternatives[row[0]]=[...new Set(urls)];photoSources[row[0]]=entry.source;}
 if(league==='NPB')for(const table of [data.bat,data.pit])for(const row of table?.rows||[]){const id=npbCatalogPlayer(row[0],code)?.id;if(id)playerLinks[row[0]]=`/players/international/npb/${id}`;}
 const playerNumbers=Object.fromEntries(Object.entries(refresh||{}).filter(([,p])=>p.number).map(([name,p])=>[playerPhotoKey(name),p.number]));
 return {...data,photos,photoAlternatives,photoSources,playerLinks,playerNumbers,photosUpdatedAt:usesCheckedPhoto?reviewed.checkedAt:refresh?refreshed.checkedAt:league==='NPB'?catalog.npbCheckedAt:catalog.checkedAt};
}

const npbCodes:Record<string,string>={'1':'g','2':'s','3':'db','4':'d','5':'t','6':'c','7':'l','8':'f','9':'m','11':'b','12':'h','376':'e'};
/** Attach the verified photo catalog on the server, scoped by season and team. */
export function withNpbLivePhotos(game:any){
 if(game.league!=='NPB'||Number(game.date?.slice(0,4))!==catalog.season)return game;
 const photo=(person:any,side:'away'|'home')=>{
  if(!person?.name)return person;
  const entry=npbCatalogPlayer(person.name,npbCodes[String(game[side]?.id)]);
  return entry?{...person,photoUrls:entry.photoUrls}:person;
 };
 const result={...game};
 for(const field of ['lineups','batting','pitching'])if(game[field])result[field]=Object.fromEntries((['away','home'] as const).map(side=>[side,(game[field][side]||[]).map((p:any)=>photo(p,side))]));
 if(game.half==='top'||game.half==='bottom'){
  result.currentBatter=photo(game.currentBatter,game.half==='top'?'away':'home');
  result.currentPitcher=photo(game.currentPitcher,game.half==='top'?'home':'away');
 }
 if(game.playText?.records)result.playText={...game.playText,records:game.playText.records.map((p:any)=>({...p,batter:photo(p.batter,p.half==='top'?'away':'home')}))};
 return result;
}
