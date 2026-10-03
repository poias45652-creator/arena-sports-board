import records from '../data/nba-player-supplements.json';

export type NbaCollegeStats = NonNullable<(typeof records)[number]['collegeStats']>;
const normalizedName = (name:string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');

// Display-only evidence, matched by both NBA ID and full name. NCAA numbers
// never replace NBA stats or become inputs to the NBA prediction model.
export function nbaPlayerSupplement(id:number,name:string){
 return records.find(row=>row.id===id&&normalizedName(row.name)===normalizedName(name))||null;
}
