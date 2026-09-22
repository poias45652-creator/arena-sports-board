// One-shot public-source smoke test: aggregated parsed sports statistics only.
// This does not log raw pages, form state, user data, credentials or database contents.
import {collectSeasonPitching} from '../server/baseball-season-pitching.mjs';
import {dayInTaipei} from '../server/baseball-live-providers.mjs';
const date=dayInTaipei();
for(const [league,teams] of [['NPB',['千葉羅德海洋','東北樂天金鷲']],['KBO',[]]]){
 const start=Date.now();const result=await collectSeasonPitching(league,date,teams);
 console.log('PITCHING_SMOKE',JSON.stringify({environment:'GitHub Actions, not Render',league,date,elapsedMs:Date.now()-start,rows:result.rows.length,sources:result.sources,errors:result.errors,verifiedThroughDates:[...new Set(result.rows.map(r=>r.source.throughDate).filter(Boolean))]}));
 if(!result.rows.length)process.exitCode=1;
}
