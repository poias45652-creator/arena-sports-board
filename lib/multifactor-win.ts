import {baseProbability,fresh,type Match} from './baseball';
import type {AnalysisReport} from './pregame-analysis';
export const WIN_MODEL_VERSION='multifactor-trial-v2-sp60';
// Starter factors retain their 2:1:1 ratio, now totaling 60%.
// Scale all other factors by 40/60 without rounding the calculation coefficients.
export const WIN_FACTOR_WEIGHTS=Object.freeze({
 season:20*2/3,starterEra:30,starterWhip:15,starterRecentEra:15,
 lineup:20*2/3,bullpenPitches:7*2/3,bullpenBackToBack:3*2/3,
 injuries:4*2/3,weatherPark:3*2/3,homeAdvantage:3*2/3,
});
export type WinFactor={name:string;weight:number;home:number|null;away:number|null;score:number|null;contribution:number;rule:string};
const valid=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const clamp=(x:number)=>Math.max(-1,Math.min(1,x));
/** Explicit engineering trial, not fitted or calibrated. Missing weights stay neutral;
 * never redistribute them to the season record or imply unavailable data was used. */
export function multifactorWin(g:Match,report:AnalysisReport|undefined,now:number){
 const p=baseProbability(g),factors:WinFactor[]=[],w=WIN_FACTOR_WEIGHTS;
 const aligned=!!report&&fresh(report.capturedAt,now,300000)&&report.game.id===g.id&&report.game.date===g.date&&report.game.season===g.season&&(['home','away'] as const).every(s=>report.game[s].id===g[s].id&&report.game[s].pitcherId===g[s].pitcherId);
 const f=aligned?report!.features:{};
 const add=(name:string,weight:number,home:unknown,away:unknown,scale:number,lower:boolean,rule:string)=>{
  const h=valid(home)?home:null,a=valid(away)?away:null,score=h!==null&&a!==null?clamp((lower?a-h:h-a)/scale):null;
  factors.push({name,weight,home:h,away:a,score,contribution:score===null?0:weight*score*.5,rule});
 };
 const wp=(s:'home'|'away')=>g[s].wins!==null&&g[s].losses!==null?(g[s].wins!+10)/(g[s].wins!+g[s].losses!+20):null;
 factors.push({name:'本季戰績',weight:w.season,home:wp('home'),away:wp('away'),score:p===null?null:2*p-1,contribution:p===null?0:w.season*(p-.5),rule:'雙方各加 10 勝 10 敗，以 log5 對戰機率轉為優勢分數'});
 add('先發本季 ERA',w.starterEra,g.home.pitcherId?g.home.pitcherEra:null,g.away.pitcherId?g.away.pitcherEra:null,4,true,'ERA 差 ÷ 4；較低有利');
 add('先發本季 WHIP',w.starterWhip,g.home.pitcherId?g.home.pitcherWhip:null,g.away.pitcherId?g.away.pitcherWhip:null,.8,true,'WHIP 差 ÷ 0.8；較低有利');
 add('先發近期 ERA',w.starterRecentEra,f.home_starter_recent_era,f.away_starter_recent_era,4,true,'來源近期登板至少 3 場；ERA 差 ÷ 4；較低有利');
 const confirmed=aligned&&['home','away'].every(s=>report!.context?.sides?.[s]?.lineupStatus==='confirmed')&&!report!.context?.lineupResolution?.secondaryLineupExcluded;
 add('九棒對左右投 wRC+',w.lineup,confirmed?f.home_lineup_wrc_plus:null,confirmed?f.away_lineup_wrc_plus:null,60,false,'確認九棒且各至少 30 打席；平均 wRC+ 差 ÷ 60；較高有利');
 add('牛棚近三日用球數',w.bullpenPitches,f.home_bullpen_last3_pitches,f.away_bullpen_last3_pitches,180,true,'用球數差 ÷ 180；用量較低有利（非疲勞實測）');
 add('牛棚連日登板人數',w.bullpenBackToBack,f.home_bullpen_back_to_back,f.away_bullpen_back_to_back,5,true,'人數差 ÷ 5；較少有利');
 for(const name of ['傷兵影響','天氣與球場','主場優勢']) factors.push({name,weight:name==='傷兵影響'?w.injuries:name==='天氣與球場'?w.weatherPark:w.homeAdvantage,home:null,away:null,score:null,contribution:0,rule:name==='傷兵影響'?'缺球員替代價值，不以傷兵人數硬扣分':name==='天氣與球場'?'缺已驗證場地與雙方差異效應':'尚無本聯盟回測係數，暫不加成'});
 const coverage=factors.filter(x=>x.score!==null).reduce((s,x)=>s+x.weight,0);
 const homeWin=p===null||!g.home.pitcherId||!g.away.pitcherId?null:.5+factors.reduce((s,x)=>s+x.contribution,0)/100;
 const conflict=aligned&&report!.issues.some(x=>x.includes('衝突')||x.includes('先發投手來源不一致'));
 const ready=homeWin!==null&&aligned&&!conflict&&confirmed&&coverage>=80;
 return {version:WIN_MODEL_VERSION,homeWin,coverage,factors,ready,reason:conflict?'先發／球員資料衝突，暫停推薦':!aligned?'分項分析尚未取得或已過期':!confirmed?'九棒打線尚未確認，僅供部分資料試算':coverage<80?'可用權重未滿 80%，暫停自動推薦':'',capturedAt:aligned?report!.capturedAt:null};
}
