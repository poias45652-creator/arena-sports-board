import {readFileSync,writeFileSync} from 'node:fs';
import {moduleUrl} from '../../tests/profile-loader.mjs';
const {domesticLeagues,tiltFootballGrid,featuredThreshold}=await import(moduleUrl('lib/football-five-league.ts'));
const {domesticScoreEstimate}=await import(moduleUrl('lib/football-domestic-fallback.ts'));
const {recentOpponents,formAdvantage}=await import(moduleUrl('lib/recent-opponents.ts'));
const {externalAsGame}=await import(moduleUrl('lib/football-xg-features.ts'));
const archive=JSON.parse(readFileSync('data/football/history-20260927.json'));
const audit={};
for(const league of domesticLeagues){
 const games=archive.games.filter(r=>r[1]===league).map(r=>externalAsGame({id:r[0],league,start:r[3],homeId:r[4],awayId:r[5],homeGoals:r[6],awayGoals:r[7],neutral:!!r[8]})).sort((a,b)=>a.start.localeCompare(b.start));
 let i=0,history=[],results=[];const segments={early:{n:0,hits:0,featured:0,featuredHits:0},recent:{n:0,hits:0,featured:0,featuredHits:0}};
 for(const game of games){
  if(game.start<'2023')continue;
  const now=Date.parse(game.start)-3600000,before=Math.floor(now/86400000)*86400000;
  while(i<games.length&&Date.parse(games[i].start)<before){const g=games[i++];history.push(g);results.push({id:g.id,at:Date.parse(g.start),home:g.home.id,away:g.away.id,homeScore:g.homeScore,awayScore:g.awayScore});}
  history=history.filter(g=>Date.parse(g.start)>=before-365*86400000);results=results.filter(g=>g.at>=before-365*86400000);
  const base=domesticScoreEstimate(game,history,before);if(!base)continue;
  const shift=.16*formAdvantage(recentOpponents(results,game.home.id,game.away.id,now,100));
  const p=tiltFootballGrid(base.scoreDistribution,shift).probabilities,ps=[p.home,p.draw,p.away],top=Math.max(...ps);
  const hit=Number(ps.indexOf(top)===(game.homeScore>game.awayScore?0:game.homeScore===game.awayScore?1:2));
  const t=game.start<'2025'?segments.early:segments.recent;t.n++;t.hits+=hit;if(top>=featuredThreshold){t.featured++;t.featuredHits+=hit;}
 }
 audit[league]={featuredEnabled:Object.values(segments).every(x=>x.featured>=50&&x.featuredHits/x.featured>x.hits/x.n),...segments};console.log(league,audit[league]);
}
writeFileSync('data/football/five-league-score-fallback.json',JSON.stringify(audit,null,2)+'\n');
