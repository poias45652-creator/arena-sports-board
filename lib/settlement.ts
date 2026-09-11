// Verified against Super007 /#/rules/tw/games and /#/rules/tw/baseball/tab03.
export type ParsedLine={line:number;boundary:number;parts?:number[];raw:string};
export function parseSourceLine(input:unknown):ParsedLine|null{
 const raw=String(input??'').trim(),s=raw.replace(/平$/,'').replace(/^PK$/i,'0')|| (raw==='平'?'0':'');
 const percent=s.match(/^(\d+)([+-])(\d{1,3})$/);
 if(percent){const n=Number(percent[1]),p=Number(percent[3]);return p<=100?{line:n,boundary:(percent[2]==='+'?1:-1)*p/100,raw}:null;}
 const split=s.split('/').map(Number);
 if(s.includes('/')){if(split.length!==2||split.some(n=>!Number.isFinite(n)||n<0||!Number.isInteger(n*2))||split[1]-split[0]!==.5)return null;return {line:(split[0]+split[1])/2,boundary:0,parts:split,raw};}
 if(!/^\d+(?:\.(?:0|25|5|75))?$/.test(s))return null;
 const line=Number(s);return {line,boundary:0,raw,...(!Number.isInteger(line*2)?{parts:[Math.floor(line*2)/2,Math.ceil(line*2)/2]}:{})};
}
export function netProfit(fraction:number,price:number){return fraction>0?fraction*price:fraction;}
export function parlayReturn(stake:number,legs:{fraction:number;price:number;void?:boolean}[]){
 if(!Number.isFinite(stake)||stake<0||!legs.length||legs.some(l=>!Number.isFinite(l.price)||l.price<=0||!Number.isFinite(l.fraction)||Math.abs(l.fraction)>1))return null;
 const returned=stake*legs.reduce((v,l)=>v*(l.void?1:1+netProfit(l.fraction,l.price)),1);
 return {returned,profit:returned-stake};
}
