export const FOOTBALL_MODEL_FAMILIES=[['recent','近期進失球'],['calibrated','賽果校準'],['elo','進球與 Elo'],['score','比分校準']] as const;
export type FootballModelFamily=typeof FOOTBALL_MODEL_FAMILIES[number][0];
export type FootballModelSettings={model:'auto'|FootballModelFamily;weights:Partial<Record<FootballModelFamily,number[]>>};
export type FootballModelCatalog={active:FootballModelFamily;models:{id:FootballModelFamily;name:string;available:boolean;defaults:number[];enabled:boolean[]}[]};
export const FOOTBALL_FACTOR_LABELS=['己方進球','對手失球','xG 進攻','xG 防守','對手強度 Elo'];
export const defaultFootballSettings=():FootballModelSettings=>({model:'auto',weights:{}});
export const footballSettingsKey=(league:string)=>`yj:football:model-weights:v1:${league}`;
export const customFootballSettings=(settings?:FootballModelSettings)=>!!settings&&(settings.model!=='auto'||Object.keys(settings.weights).length>0);
// Stable identity across JSON property order; never mix two members' different weights.
export function footballForecastSettingsKey(settings?:FootballModelSettings){
 if(!customFootballSettings(settings))return '';
 return JSON.stringify([settings!.model,FOOTBALL_MODEL_FAMILIES.map(([id])=>[id,settings!.weights[id]??null])]);
}
export function footballPercentages(values:number[]){const sum=values.reduce((a,b)=>a+b,0);return values.map(v=>sum?v/sum*100:0);}
export function rebalanceFootballWeight(values:number[],index:number,value:number,enabled:boolean[]){
 const next=[...values],rest=enabled.map((v,i)=>v&&i!==index?i:-1).filter(i=>i>=0),target=Math.max(0,Math.min(100,value));if(!enabled[index]||!rest.length)return next;
 next[index]=target;const sum=rest.reduce((s,i)=>s+values[i],0);for(const i of rest)next[i]=(100-target)*(sum?values[i]/sum:1/rest.length);return next;
}
export function parseFootballSettings(raw:unknown):FootballModelSettings|null{
 try{const d=typeof raw==='string'?JSON.parse(raw):raw;if(!d||typeof d!=='object'||Array.isArray(d)||!['auto',...FOOTBALL_MODEL_FAMILIES.map(([k])=>k)].includes(d.model)||!d.weights||typeof d.weights!=='object'||Array.isArray(d.weights))return null;
  const weights:FootballModelSettings['weights']={};for(const [key,value] of Object.entries(d.weights)){if(!FOOTBALL_MODEL_FAMILIES.some(([id])=>id===key)||!Array.isArray(value)||value.length!==5||value.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>100)||Math.abs(value.reduce((s,n)=>s+n,0)-100)>.001)return null;weights[key as FootballModelFamily]=[...value];}return {model:d.model,weights};
 }catch{return null;}
}
export function validateFootballSettings(settings:FootballModelSettings,catalog:FootballModelCatalog){
 if(settings.model!=='auto'&&!catalog.models.some(m=>m.id===settings.model&&m.available))return false;
 return Object.entries(settings.weights).every(([id,values])=>{const model=catalog.models.find(m=>m.id===id);return !!model?.available&&values!.every((v,i)=>model.enabled[i]||v===0);});
}
export function footballWeightedParameters<T extends object>(parameters:T,settings:FootballModelSettings|undefined,family:FootballModelFamily,keys:readonly string[]):T{
 const values=settings?.weights[family];if(!values)return parameters;
 const p=parameters as Record<string,number>,sum=keys.reduce((n,key)=>n+(Number(p[key])||0),0);if(sum<=0)return parameters;
 const result={...parameters} as Record<string,number>;keys.forEach((key,i)=>{if(key)result[key]=sum*values[i]/100;});return result as T;
}
