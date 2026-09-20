import type {PregameData} from './international-pregame';
import review from '@/data/cpbl-cao-review-20260920.json';

// This is a reviewed correction to one saved row, not a rule that all sources'
// "walks" include HBP. Preserve the original import and retain the audit below.
export function applyCpblPitcherReview(data:PregameData):PregameData{
 if(data.league!=='CPBL'||data.date!==review.fixtureDate)return data;
 return {...data,games:data.games.map(g=>{
  if(g.id!==review.fixtureId||g.away.team!==review.team)return g;
  const p=g.away.starter,s=p.season,r=p.recent;
  if(p.name!==review.pitcher||p.quality!=='needs_review'||p.warnings.length!==1||p.warnings[0]!==review.originalWarning)return g;
  if(s.innings!=='4.0'||s.walks!=='4'||Number(s.whip)!==2||s.era!=='6.75')return g;
  const date=r.headers.indexOf('日期'),walks=r.headers.indexOf('保送'),hits=r.headers.indexOf('安打');
  if(date<0||walks<0||hits<0||r.rows.length!==1||r.rows[0][date]!==review.outingDate||r.rows[0][walks]!=='5'||r.rows[0][hits]!=='4')return g;
  const headers=r.headers.map((h,i)=>i===walks?'四死球':h);
  return {...g,away:{...g.away,starter:{...p,quality:'source_reported',warnings:[],recent:{...r,headers},review:{reviewedAt:review.reviewedAt,note:review.conclusion,sources:review.sources}}}};
 })};
}
