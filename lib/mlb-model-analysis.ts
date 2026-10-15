import {fresh,type Match} from './baseball';
import {scoreGrid,type RunSnapshot} from './markets';
import {scoreDistribution} from './baseball-run-analysis';
import {winnerAnalysis,type WinnerAnalysis} from './winner-analysis';
import type {AnalysisReport} from './pregame-analysis';
import {INNINGS_DEFAULTS,normalizeBaseballWeights,type BaseballModelSettings,type InningWeights} from './baseball-model-settings';

/** Weighted run rates are engineering estimates, not fitted win probabilities.
 * Missing bullpen measurements retain a neutral league-average share. */
export function mlbInningProjection(game:Match,data:RunSnapshot|null,weights:InningWeights){
 if(!data||data.year!==game.season||!Number.isFinite(data.league)||data.league<=0)return null;
 const w=normalizeBaseballWeights(weights,INNINGS_DEFAULTS);if(!w)return null;
 const rate=(side:'home'|'away')=>{
  const other=side==='home'?'away':'home',bat=data.rows.find(r=>r.id===game[side].id),pit=data.rows.find(r=>r.id===game[other].id);
  if(!bat||!pit||bat.batGames<20||pit.pitchGames<20)return null;
  const offense=(bat.scored+20*data.league)/(bat.batGames+20),defense=(pit.allowed+20*data.league)/(pit.pitchGames+20),era=game[other].pitcherEra;
  const starter=game[other].pitcherId&&typeof era==='number'&&Number.isFinite(era)&&era>=0?era:data.league;
  const full=(w.starter*starter+w.offense*offense+w.defense*defense+w.bullpen*data.league)/100;
  // No starter in extra frames. An all-starter setting falls back to a neutral rate.
  const rest=w.offense+w.defense+w.bullpen;
  const extra=rest?(w.offense*offense+w.defense*defense+w.bullpen*data.league)/rest:data.league;
  return {full,extra};
 };
 const a=rate('away'),h=rate('home');if(!a||!h||[a.full,h.full,a.extra,h.extra].some(n=>!Number.isFinite(n)||n<=0||n>15))return null;
 const regulation=scoreDistribution(Array(9).fill(a.full/9),Array(9).fill(h.full/9));
 // Resolve regulation ties with the conditional next decisive Poisson frame.
 // This approximates extra innings; automatic runners and intervening tied runs are not modeled.
 const extra=scoreGrid(a.extra/9,h.extra/9,false).filter(o=>o.away!==o.home&&o.p>1e-16),mass=extra.reduce((s,o)=>s+o.p,0);
 if(!regulation.length||!mass)return null;
 const full=regulation.flatMap(o=>o.away===o.home?extra.map(e=>({away:o.away+e.away,home:o.home+Math.min(e.home,e.away+1),p:o.p*e.p/mass})):[o]);
 const half=scoreGrid(a.full*5/9,h.full*5/9,false),homeWin=full.reduce((s,o)=>s+(o.home>o.away?o.p:0),0);
 return {runs:{away:a.full,home:h.full},full,half,homeWin,notes:['逐局得分採獨立卜瓦松分布；九局下領先免打、再見比分以超前一分近似。','延長賽採下一個分出勝負的局數近似，未納入突破僵局跑者與中途平手局的累積得分。','牛棚缺少獨立實測 ERA，以本季聯盟得分均值維持中性權重。']};
}
export function mlbSelectedWinner(game:Match,report:AnalysisReport|undefined,now:number,scheduleOK:boolean,settings:BaseballModelSettings,market:'moneyline'|'fullGamePk',projection:ReturnType<typeof mlbInningProjection>,runsFresh:boolean):WinnerAnalysis{
 const base=winnerAnalysis(game,report,now,scheduleOK,settings.weights.multifactor);
 if(settings[market]==='multifactor'||!base.canEstimate)return base;
 if(!projection||!runsFresh)return {...base,homeWin:null,canEstimate:false,canRecommend:false,ready:false,status:'blocked',favoredSide:null,reason:'逐局得分所需的本季得失分資料不足或已過期'};
 const homeWin=projection.homeWin,favoredSide=Math.abs(homeWin-.5)<1e-6?null:homeWin>.5?'home':'away';
 return {...base,version:'mlb-personal-innings-v1',homeWin,favoredSide,canRecommend:favoredSide!==null,ready:false,status:'preliminary',reason:projection.notes.join(' '),factors:[],coverage:100-settings.weights.innings.bullpen,missing:['牛棚獨立實測 ERA']};
}
export const mlbRunsFresh=(data:RunSnapshot|null,error:string,now:number)=>!error&&fresh(data?.fetchedAt,now,25*60000);
