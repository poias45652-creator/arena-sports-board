import archive from '../data/statcast-history.json';
const data:any=archive,columns:string[]=data.metadata.columns,index=Object.fromEntries(columns.map((c,i)=>[c,i]));
const value=(r:any[],k:string)=>r[index[k]];
export const statcastHistorySummary=()=>data.metadata;
export async function statcastHistoryRecords({pitcherId,gameId,before,offset=0}:{pitcherId?:number;gameId?:number;before:string;offset?:number},load:(path:string)=>Promise<any[]>){
 const groups=data.groups.filter((g:any)=>g.date<before&&(!pitcherId||g.pitcherId===pitcherId)&&(!gameId||g.gameId===gameId));
 const counts=new Map<string,number>();for(const g of groups)counts.set(g.date,(counts.get(g.date)||0)+g.records);
 const total=groups.reduce((s:number,g:any)=>s+g.records,0),rows:any[]=[];let skip=offset;
 for(const day of data.metadata.days){const count=counts.get(day.date)||0;if(!count)continue;if(skip>=count){skip-=count;continue;}
  const loaded=await load(day.path);const matched=loaded.filter((r:any[])=>value(r,'game_date')<before&&(!pitcherId||value(r,'pitcher')===pitcherId)&&(!gameId||value(r,'game_pk')===gameId));
  if(matched.length!==count)throw new Error('歷史資料分檔與索引不符');rows.push(...matched.slice(skip,skip+100-rows.length));skip=0;if(rows.length===100)break;
 }
 return {source:data.metadata.source,start:data.metadata.start,end:data.metadata.end,before,columns,rows,total,offset,limit:100,outcomeColumns:data.metadata.outcomeColumns,modelApplied:false};
}
export function historicalPitcher(pitcherId:number,before:string){
 const rows=data.groups.filter((g:any)=>g.pitcherId===pitcherId&&g.date<before),types=new Map<string,{records:number;speedN:number;speedSum:number;spinN:number;spinSum:number}>();
 for(const g of rows){const t=types.get(g.pitchType)||{records:0,speedN:0,speedSum:0,spinN:0,spinSum:0};for(const k of ['records','speedN','speedSum','spinN','spinSum'] as const)t[k]+=g[k];types.set(g.pitchType,t);}
 const dates=rows.map((g:any)=>g.date).sort();
 return {pitcherId,source:data.metadata.source,archiveStart:data.metadata.start,archiveEnd:data.metadata.end,before,firstDate:dates[0]??null,lastDate:dates.at(-1)??null,records:rows.reduce((s:number,g:any)=>s+g.records,0),games:new Set(rows.map((g:any)=>g.gameId)).size,arsenal:[...types].map(([pitchType,t])=>({pitchType,records:t.records,measuredSpeedRecords:t.speedN,meanReleaseSpeed:t.speedN?t.speedSum/t.speedN:null,measuredSpinRecords:t.spinN,meanSpinRate:t.spinN?t.spinSum/t.spinN:null})),usage:'historical_reference_only',modelApplied:false,notCurrentForm:true};
}
