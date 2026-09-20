import type {PregameData,PregameSide} from './international-pregame';
import audit from '@/data/kbo-pitcher-review-20260920.json';

// Corrections apply only to the exact saved, independently reviewed rows.
// Never generalize 2.0 -> 0.2, override a new pitcher, or relabel source time.
export function applyKboPitcherReview(data:PregameData):PregameData{
 if(data.league!=='KBO'||data.date!==audit.date)return data;
 return {...data,games:data.games.map(g=>{
  const r=audit.reviews.find(r=>r.fixtureId===g.id&&r.fixtureDate===g.date);
  if(!r)return g;
  const side=r.side as 'away'|'home',team=g[side],p=team.starter;
  if(team.team!==r.team||p.name!==r.pitcher||p.quality!==r.originalQuality||JSON.stringify(p.warnings)!==JSON.stringify(r.originalWarnings))return g;
  if(Object.entries(r.originalSeason).some(([key,value])=>p.season[key as keyof typeof p.season]!==value))return g;
  if(JSON.stringify(p.recent)!==JSON.stringify(r.originalRecent)||JSON.stringify(p.splits)!==JSON.stringify(r.originalSplits))return g;
  const tables={recent:{...p.recent,rows:p.recent.rows.map(row=>[...row])},splits:{...p.splits,rows:p.splits.rows.map(row=>[...row])}};
  for(const c of r.changes){
   const table=tables[c.table as keyof typeof tables],column=table.headers.indexOf(c.column),row=table.rows.find(row=>row[0]===c.row);
   if(!row||column<0||row[column]!==c.before)return g;
   row[column]=c.after;
  }
  const starter:PregameSide['starter']={...p,...tables,quality:'source_reported',warnings:[],review:{reviewedAt:r.reviewedAt,note:r.conclusion,sources:r.sources}};
  return {...g,[side]:{...team,starter}};
 })};
}
