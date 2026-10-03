import type {NbaGame} from './nba';
import type {EfficiencyAnalysis} from './basketball-efficiency';
export type PlayerAvailability='out'|'doubtful'|'questionable'|'probable'|'expected'|'unknown';
export type PlayerEvidence={id:number;name:string;status:PlayerAvailability;publishedAt?:string;sourceUrl:string;minutesCap?:number;minutesConfirmed?:boolean};
export type PlayerRating={games:number;rate:number;minutes:number;lastPlayed:number;sampleMinutes:number;points:number;rebounds:number;assists:number;steals:number;blocks:number;turnovers:number;name:string;sourceId:string};
export type RotationPlayer=PlayerEvidence&{minutes:number;minutesLow:number;minutesHigh:number;rating:PlayerRating|null};
export type NbaPlayerContext={status:'applied'|'unavailable';marginSigma?:number;reason?:string;calibrated:boolean;preseason:boolean;minutesConfirmed:boolean;recommendationEligible:boolean;sourceFetchedAt:string;statsCapturedAt:string;home:RotationPlayer[];away:RotationPlayer[];homeOpponentNet?:number;awayOpponentNet?:number;marginRange?:[number,number];probabilityRange?:[number,number];features?:number[];coefficients?:number[];sources:string[]};
export type TeamStats={net:number;sos:number;strength:number;rest:number;games:number;lastPlayed:number;pointsFor:number;pointsAgainst:number};
export function availabilityFromNews(id:number,name:string,sourceUrl:string,news:any[],now:number,opponentWords:string[]=[]):PlayerEvidence{
 const rows=news.filter(n=>Number(n.nbaId??n.wnbaId??n.Player?.NBAId)===id&&Number.isFinite(Number(n.date??n.DateTime))&&Number(n.date??n.DateTime)<=now&&now-Number(n.date??n.DateTime)<=72*3600000).sort((a,b)=>Number(b.date??b.DateTime)-Number(a.date??a.DateTime));
 const n=rows[0];if(!n)return {id,name,status:'unknown',sourceUrl};
 const structured=String(n.injuredStatus??n.Injury?.Status??'').toUpperCase();
 const text=String(n.update??n.Notes??''),headline=String(n.headline??n.Headline??'');
 const matchup=opponentWords.some(w=>w&&text.toLowerCase().includes(w.toLowerCase()));
 let status:PlayerAvailability=structured==='OUT'?'out':structured==='DOUBTFUL'?'doubtful':structured==='QUESTIONABLE'?'questionable':structured==='PROBABLE'?'probable':'unknown';
 // Negative wording is checked first: "unlikely to play" must never match
 // "likely to play". Natural-language reports remain reports, not official
 // confirmation of the game's active list.
 if(status==='unknown'&&matchup){
  if(/unlikely to play|not expected to play|doubtful/i.test(text))status='doubtful';
  else if(/ruled out|will not play|won't play|will sit out|will miss|unavailable for|not available/i.test(text))status='out';
  else if(/questionable/i.test(text))status='questionable';
  else if(/probable/i.test(text))status='probable';
  else if(/expected to play|likely to play|will play|available (?:to play|for)/i.test(text))status='expected';
 }
 const cap=matchup&&/minute|minutes/i.test(text)?/(?:limited to|limit of|cap of)\s+(\d{1,2})\s+minutes/i.exec(text):null;
 const minutesCap=cap&&Number(cap[1])>=1&&Number(cap[1])<=48?Number(cap[1]):undefined;
 return {id,name,status,sourceUrl,publishedAt:new Date(Number(n.date??n.DateTime)).toISOString(),minutesCap,minutesConfirmed:minutesCap!==undefined};
}
export type PlayerStrengthSnapshot={capturedAt:string;source:string;players:Record<string,PlayerRating>;teams:Record<string,TeamStats>};
export type PlayerStrengthModel={enabled:boolean;regularSeasonValidated:boolean;coefficients:number[];sigma:number};
export function createPlayerStrengthEngine({league,regulationMinutes,model,snapshot}:{league:'NBA'|'WNBA';regulationMinutes:40|48;model:PlayerStrengthModel;snapshot:PlayerStrengthSnapshot}){
 const playerRatings=snapshot.players,teams=snapshot.teams;
// Allocate regulationMinutes * 5 player-minutes, respecting sourced caps.
function allocateMinutes(players:PlayerEvidence[],preseason:boolean,scenario:'low'|'central'|'high'){
 const cap=preseason?({low:16,central:20,high:24}[scenario])*regulationMinutes/48:regulationMinutes;
 const availability=(s:PlayerAvailability)=>s==='out'?0:s==='doubtful'?({low:0,central:.25,high:1}[scenario]):s==='questionable'?({low:0,central:.5,high:1}[scenario]):s==='probable'?.9:1;
 const rows=players.map(p=>{const r=playerRatings[String(p.id)],weight=(r?.minutes??6)*availability(p.status),ceiling=p.status==='out'?0:Math.min(regulationMinutes,p.minutesCap??(preseason&&r&&r.minutes>=regulationMinutes/2?cap:preseason?28*regulationMinutes/48:regulationMinutes));return {p,weight,ceiling,minutes:0};});
 let left=5*regulationMinutes;
 for(let iteration=0;iteration<players.length+2&&left>1e-8;iteration++){
  const eligible=rows.filter(r=>r.weight>0&&r.minutes<r.ceiling-1e-8),weight=eligible.reduce((n,r)=>n+r.weight,0);if(!weight)break;
  let used=0;for(const r of eligible){const add=Math.min(r.ceiling-r.minutes,left*r.weight/weight);r.minutes+=add;used+=add;}left-=used;
 }
 if(left>1e-5)throw Error('可用球員不足以分配全場上場分鐘');
 return rows.map(r=>({id:r.p.id,minutes:r.minutes}));
}
function rotation(players:PlayerEvidence[],preseason:boolean):RotationPlayer[]{
 if(new Set(players.map(p=>p.id)).size!==players.length||players.length<8)throw Error('現役名單不完整');
 const scenarios=['low','central','high'].map(s=>allocateMinutes(players,preseason,s as 'low'|'central'|'high'));
 return players.map((p,i)=>({...p,minutes:scenarios[1][i].minutes,minutesLow:Math.min(...scenarios.map(s=>s[i].minutes)),minutesHigh:Math.max(...scenarios.map(s=>s[i].minutes)),rating:playerRatings[String(p.id)]??null}));
}
function normalCdf(x:number){const a=Math.abs(x),t=1/(1+.2316419*a),phi=Math.exp(-a*a/2)/Math.sqrt(2*Math.PI),v=1-phi*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?v:1-v;}
const value=(r:RotationPlayer[])=>r.reduce((n,p)=>n+p.minutes*(p.rating?.rate??.30),0);
function applyPlayerStrength(game:NbaGame,base:EfficiencyAnalysis,homeEvidence:PlayerEvidence[],awayEvidence:PlayerEvidence[],now=Date.now()):EfficiencyAnalysis{
 const context:NbaPlayerContext={status:'unavailable',calibrated:false,preseason:game.phase===1,minutesConfirmed:false,recommendationEligible:false,sourceFetchedAt:new Date(now).toISOString(),statsCapturedAt:snapshot.capturedAt,home:[],away:[],sources:[`${league}.com current rosters and player availability reports`,snapshot.source]};
 const waiting=(reason:string):EfficiencyAnalysis=>({...base,status:'waiting',expected:undefined,probabilities:undefined,simulation:undefined,playerContext:{...context,reason}});
 if((game.home.league||'NBA')!==league||(game.away.league||'NBA')!==league)return base;
 if(base.status!=='ready'||!base.expected)return waiting('efficiency_baseline_unavailable');
 const age=now-Date.parse(snapshot.capturedAt),h=teams[game.home.id],a=teams[game.away.id];
 if(!model.enabled||!Number.isFinite(age)||age<0||age>36*3600000||!h||!a)return waiting('player_snapshot_missing_or_stale');
 if(Date.parse(game.start)<=now||Date.parse(game.start)-now>72*3600000)return waiting('outside_availability_window');
 const home=rotation(homeEvidence,context.preseason),away=rotation(awayEvidence,context.preseason);
 const coverage=(r:RotationPlayer[])=>r.filter(p=>p.rating&&p.rating.games>=8).reduce((n,p)=>n+p.minutes,0)/(5*regulationMinutes);
 if(Math.min(coverage(home),coverage(away))<.75)return waiting('insufficient_individual_minutes_coverage');
 // Old team results lose relevance across an offseason. This preseason
 // adjustment is explicitly a scenario estimate, not a calibrated win rate.
 const relevance=(t:TeamStats)=>context.preseason?Math.exp(-Math.max(0,(now/1000-t.lastPlayed)/86400-30)/90):1;
 const features=(hs:number,as:number)=>[game.neutral?0:1,hs-as,h.net*relevance(h)-a.net*relevance(a),h.sos*relevance(h)-a.sos*relevance(a),Math.min(7,(Date.parse(game.start)/1000-h.lastPlayed)/86400)-Math.min(7,(Date.parse(game.start)/1000-a.lastPlayed)/86400)];
 const project=(x:number[])=>x.reduce((n,v,i)=>n+v*model.coefficients[i],0);
 const x=features(value(home),value(away)),margin=project(x);
 const strengthScenario=(e:PlayerEvidence[],s:'low'|'central'|'high')=>allocateMinutes(e,context.preseason,s).reduce((n,p)=>n+p.minutes*(playerRatings[String(p.id)]?.rate??.30),0);
 const margins:number[]=[];for(const hs of ['low','central','high'] as const)for(const as of ['low','central','high'] as const)margins.push(project(features(strengthScenario(homeEvidence,hs),strengthScenario(awayEvidence,as))));
 const probabilities=margins.map(m=>normalCdf(m/model.sigma)),homeProbability=normalCdf(margin/model.sigma);
 const round=(x:number)=>Math.round(x*10)/10,total=base.expected.total,homeScore=round((total+margin)/2),awayScore=round((total-margin)/2);
 const minutesConfirmed=[...home,...away].filter(p=>p.minutes>0).every(p=>p.minutesConfirmed);
 const uncertain=[...home,...away].some(p=>['unknown','questionable','doubtful'].includes(p.status)&&p.minutesHigh>12);
 return {...base,model:league==='NBA'?'nba-player-opponent-v3':'wnba-player-opponent-v3',capturedAt:new Date(now).toISOString(),simulation:undefined,expected:{home:homeScore,away:awayScore,total:round(homeScore+awayScore),margin:round(homeScore-awayScore)},probabilities:{home:homeProbability,away:1-homeProbability},playerContext:{...context,status:'applied',marginSigma:model.sigma,calibrated:!context.preseason&&model.regularSeasonValidated,home,away,minutesConfirmed,recommendationEligible:!context.preseason&&!uncertain,homeOpponentNet:h.sos,awayOpponentNet:a.sos,marginRange:[Math.min(...margins),Math.max(...margins)],probabilityRange:[Math.min(...probabilities),Math.max(...probabilities)],features:x,coefficients:model.coefficients}};
}


 return {allocateMinutes,rotation,applyPlayerStrength,playerRatings};
}
