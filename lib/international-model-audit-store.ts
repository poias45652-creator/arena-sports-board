import {getRawDb} from '@/db';
import {createForecastSnapshots,auditFinalFromLive,summarizeForecasts,type ForecastSnapshot,type AuditFinal} from './international-model-audit';
import type {PregameData} from './international-pregame';

export async function saveInternationalForecasts(data:PregameData){
 let rows:ForecastSnapshot[]=[];
 try{
  rows=createForecastSnapshots(data,Date.now());if(!rows.length)return {eligible:0,written:0,error:null};
  const db=getRawDb();const result=await db.batch(rows.map(r=>db.prepare(`INSERT INTO international_forecasts (id,league,fixture_key,date,start_time,captured_at,version,payload) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
   .bind(r.id,r.league,r.fixtureKey,r.date,r.startTime,r.capturedAt,r.version,JSON.stringify(r.payload))));
  return {eligible:rows.length,written:result.reduce((n:number,r:any)=>n+(r.meta?.changes||0),0),error:null};
 }catch{return {eligible:rows.length,written:0,error:'賽前預測留存失敗，本次不計入可核對紀錄'};}
}
export async function readInternationalForecastAudit(){
 const db=getRawDb(),now=Date.now(),cutoff=new Date(now-90*86400000).toISOString();
 // Select one immutable pregame forecast per fixture/version before reading payloads.
 const [saved,finals,count]=await Promise.all([
  db.prepare(`SELECT payload FROM (SELECT payload,ROW_NUMBER() OVER (PARTITION BY league,fixture_key,version ORDER BY captured_at DESC) AS position FROM international_forecasts WHERE captured_at<=strftime('%Y-%m-%dT%H:%M:%fZ',start_time,'-60 seconds') AND start_time>=?) WHERE position=1 ORDER BY json_extract(payload,'$.startTime') DESC LIMIT 2001`).bind(cutoff).all(),
  db.prepare("SELECT payload FROM baseball_current WHERE date>=? AND status='final' ORDER BY fetched_at DESC LIMIT 4001").bind(cutoff.slice(0,10)).all(),
  db.prepare('SELECT COUNT(*) AS snapshots,MIN(captured_at) AS firstCapturedAt,MAX(captured_at) AS latestCapturedAt FROM international_forecasts').first()
 ]);
 const predictions:ForecastSnapshot['payload'][]=[],results:AuditFinal[]=[];let unreadable=0;
 for(const row of saved.results.slice(0,2000))try{predictions.push(JSON.parse(String(row.payload)));}catch{unreadable++;}
 for(const row of finals.results.slice(0,4000))try{const g=auditFinalFromLive(JSON.parse(String(row.payload)),now);if(g)results.push(g);}catch{unreadable++;}
 return {...summarizeForecasts(predictions,results,now),...count,unreadable,truncated:saved.results.length>2000||finals.results.length>4000,windowDays:90,checkedAt:new Date(now).toISOString()};
}
