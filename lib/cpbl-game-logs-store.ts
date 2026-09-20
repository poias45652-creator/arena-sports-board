import {getRawDb} from '@/db';
import archive from '@/data/cpbl-game-logs-20260920.json';
import {collectCpblGameLogs} from '@/server/cpbl-game-logs-source.mjs';
import type {CpblLogSnapshot} from './cpbl-game-logs';

type Result={snapshot:CpblLogSnapshot;error:string|null};
const cache=new Map<number,{until:number;value:Result}>(),pending=new Map<number,Promise<Result>>();
export async function getCpblGameLogs(season:number):Promise<Result>{
 const previous=cache.get(season);if(previous&&previous.until>Date.now())return previous.value;
 if(pending.has(season))return pending.get(season)!;
 const task=(async()=>{
  let saved=previous?.value.snapshot||(archive.season===season?archive as CpblLogSnapshot:{schemaVersion:1,league:'CPBL',season,observedAt:'',checkedAt:'',sources:[],games:[],errors:[]});
  let storageError:string|null=null;
  try{const row=await getRawDb().prepare('SELECT payload FROM baseball_log_snapshots WHERE key=?').bind('CPBL:'+season).first<{payload:string}>();if(row){const stored=JSON.parse(row.payload);if(stored.league==='CPBL'&&stored.season===season&&Date.parse(stored.checkedAt)>Date.parse(saved.checkedAt||'1970-01-01'))saved=stored;}}catch{storageError='逐場日誌儲存服務暫時無法讀取';}
  let snapshot=saved,error=storageError;
  if(!saved.checkedAt||Date.now()-Date.parse(saved.checkedAt)>300000){
   try{const deadline=AbortSignal.timeout(30000);snapshot=await collectCpblGameLogs({season,previous:saved,maxDetails:6,fetcher:(url,init={})=>fetch(url,{...init,signal:init.signal?AbortSignal.any([deadline,init.signal]):deadline})});}
   catch{error='逐場來源更新失敗，保留上次日誌及原擷取時間';}
  }
  if(snapshot.games.length)try{await getRawDb().prepare(`INSERT INTO baseball_log_snapshots (key,league,season,observed_at,payload) VALUES (?,?,?,?,?)
   ON CONFLICT(key) DO UPDATE SET observed_at=excluded.observed_at,payload=excluded.payload WHERE excluded.observed_at>=baseball_log_snapshots.observed_at`)
   .bind('CPBL:'+season,'CPBL',season,snapshot.checkedAt,JSON.stringify(snapshot)).run();}catch{error='本次逐場日誌未能保存；仍使用原時間，不標成已保存';}
  const value={snapshot,error};cache.set(season,{until:Date.now()+(error?60000:300000),value});return value;
 })().finally(()=>pending.delete(season));pending.set(season,task);return task;
}
