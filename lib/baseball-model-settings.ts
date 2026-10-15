export type BaseballModelFamily='multifactor'|'innings';
export type BaseballModelLeague='MLB'|'NPB'|'CPBL'|'KBO';
export const BASEBALL_MODEL_NAMES={multifactor:'多因子',innings:'逐局得分'} as const;
export const MULTIFACTOR_DEFAULTS={season:40/3,starterEra:30,starterWhip:15,starterRecentEra:15,lineup:40/3,bullpenPitches:14/3,bullpenBackToBack:2,injuries:8/3,weatherPark:2,homeAdvantage:2};
export const INNINGS_DEFAULTS={starter:60,offense:20,defense:10,bullpen:10};
export type MultiWeights=typeof MULTIFACTOR_DEFAULTS;
export type InningWeights=typeof INNINGS_DEFAULTS;
export type BaseballModelSettings={version:1;moneyline:BaseballModelFamily;fullGamePk:BaseballModelFamily;weights:{multifactor:MultiWeights;innings:InningWeights}};
export const BASEBALL_FACTOR_LABELS={season:'本季戰績',starterEra:'先發投手本季防禦率 ERA',starterWhip:'先發投手本季每局被上壘率 WHIP',starterRecentEra:'先發投手近期防禦率 ERA',lineup:'九棒對左右投打擊能力',bullpenPitches:'牛棚近三日用球數',bullpenBackToBack:'牛棚連日登板人數',injuries:'傷兵影響',weatherPark:'天氣與球場',homeAdvantage:'主場優勢',starter:'先發投手防禦率',offense:'己方得分能力',defense:'對手失分能力',bullpen:'對手牛棚防禦率'} as const;
export const defaultBaseballSettings=():BaseballModelSettings=>({version:1,moneyline:'multifactor',fullGamePk:'multifactor',weights:{multifactor:{...MULTIFACTOR_DEFAULTS},innings:{...INNINGS_DEFAULTS}}});
export const baseballSettingsKey=(league:BaseballModelLeague)=>`yj:baseball:model-weights:v1:${league}`;
export const baseballSettingsSignature=(s:BaseballModelSettings)=>JSON.stringify(s);
export const customBaseballSettings=(s:BaseballModelSettings)=>baseballSettingsSignature(s)!==baseballSettingsSignature(defaultBaseballSettings());
export function normalizeBaseballWeights<T extends Record<string,number>>(raw:unknown,defaults:T):T|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const d=raw as Record<string,unknown>,keys=Object.keys(defaults);
 if(Object.keys(d).length!==keys.length||keys.some(k=>typeof d[k]!=='number'||!Number.isFinite(d[k])||(d[k] as number)<0||(d[k] as number)>100))return null;
 const sum=keys.reduce((n,k)=>n+(d[k] as number),0);if(sum<=0)return null;
 return Object.fromEntries(keys.map(k=>[k,Math.abs(sum-100)<1e-9?(d[k] as number):(d[k] as number)/sum*100])) as T;
}
export function parseBaseballSettings(raw:unknown):BaseballModelSettings|null{
 try{const d=typeof raw==='string'?JSON.parse(raw):raw;if(!d||d.version!==1||!['multifactor','innings'].includes(d.moneyline)||!['multifactor','innings'].includes(d.fullGamePk))return null;
 const multifactor=normalizeBaseballWeights(d.weights?.multifactor,MULTIFACTOR_DEFAULTS),innings=normalizeBaseballWeights(d.weights?.innings,INNINGS_DEFAULTS);
 return multifactor&&innings?{version:1,moneyline:d.moneyline,fullGamePk:d.fullGamePk,weights:{multifactor,innings}}:null;
 }catch{return null;}
}
/** Explicitly chosen weights total 100%; absent observations keep their assigned neutral share. */
export function rebalanceBaseballWeight<T extends Record<string,number>>(weights:T,key:keyof T,value:number):T{
 const next={...weights},keys=Object.keys(weights).filter(k=>k!==key),v=Math.max(0,Math.min(100,value));
 if(!Number.isFinite(v)||!(key in weights)||!keys.length)return next;
 const sum=keys.reduce((n,k)=>n+weights[k],0);next[key]=v as T[keyof T];
 for(const k of keys)next[k as keyof T]=((100-v)*(sum?weights[k]/sum:1/keys.length)) as T[keyof T];return next;
}
