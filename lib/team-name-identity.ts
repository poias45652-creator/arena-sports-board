// Formatting only. Never remove squad qualifiers, club words, digits or G1/G2.
export const cleanTeamName=(name:string)=>name.normalize('NFKC').replace(/\((?:主|客)\)/gu,'').trim();
export const teamNameKey=(name:string)=>cleanTeamName(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/[–—]/g,'-').replace(/\s/g,'').toLowerCase();
export const hasSquadQualifier=(name:string)=>/(?:女|青年|預備|预备|二隊|二队|三隊|三队|後備|后备|u\s*[- ]?\d{1,2}\b|(?:women(?:'s)?|ladies|reserves?|youth)\b|\b(?:ii|iii)\b|(?:\s|\()B(?:\s|\)|$))/i.test(name.normalize('NFKC'));

/** Exact registered aliases, indexed once. Conflicting aliases fail closed. */
export function teamNameResolver(entries:Iterable<readonly [string,string]>){
 const index=new Map<string,string|null>();
 for(const [alias,canonical] of entries)for(const name of [alias,canonical]){
  const key=teamNameKey(name);if(!key)continue;
  index.set(key,index.has(key)&&index.get(key)!==canonical?null:canonical);
 }
 return (name:string):string|null=>index.get(teamNameKey(name))??null;
}
