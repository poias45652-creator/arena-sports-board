// Build-produced public source data only. Never contains member markets, accounts
// or credentials, and never seeds forecasts or the current/live scoreboard.
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export type NbaSeedKind='official'|'efficiency';
export type NbaSeedEntry={kind:NbaSeedKind;key:string;capturedAt:number;data:any;sha256:string};
const MAX_BYTES=16*1024*1024,MAX_ROWS=1500;
const digest=(data:any)=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
const permitted=(kind:unknown,key:unknown)=>typeof key==='string'&&key.length<500&&(kind==='official'?/^(players|team\/[1-9]\d*\/[a-z0-9-]+|player\/[1-9]\d*\/[a-z0-9-]+)$/.test(key):kind==='efficiency'&&key.startsWith('NBA:'));
export function createNbaSeedReader(document:any,clock=()=>Date.now()){
 const rows=new Map<string,NbaSeedEntry>();
 if(document?.schema===1&&Array.isArray(document.entries)&&document.entries.length<=MAX_ROWS){
  const duplicates=new Set<string>();let bytes=0;
  for(const row of document.entries){
   try{
    if(!row||!permitted(row.kind,row.key)||!Number.isFinite(row.capturedAt)||!row.data||typeof row.data!=='object'||typeof row.sha256!=='string')continue;
    const size=Buffer.byteLength(JSON.stringify(row));bytes+=size;if(bytes>MAX_BYTES){rows.clear();break;}
    const key=row.kind+':'+row.key;if(rows.has(key)){rows.delete(key);duplicates.add(key);continue;}
    if(!duplicates.has(key))rows.set(key,row);
   }catch{continue;}
  }
 }
 return (kind:NbaSeedKind,key:string,maxAge:number)=>{
  const id=kind+':'+key,row=rows.get(id);if(!row)return null;
  // Consume once into the caller's bounded cache rather than retaining copies.
  rows.delete(id);const age=clock()-row.capturedAt;
  if(!Number.isFinite(maxAge)||maxAge<=0||age<0||age>=maxAge)return null;
  try{if(digest(row.data)!==row.sha256)return null;return {data:row.data,capturedAt:row.capturedAt};}catch{return null;}
 };
}
let reader:ReturnType<typeof createNbaSeedReader>|undefined;
export function readNbaSeed(kind:NbaSeedKind,key:string,maxAge:number){
 if(process.env.YJ_NBA_SEED_CAPTURE==='1'||process.env.YJ_NBA_DISABLE_SEED==='1')return null;
 if(!reader){
  let document:any=null;
  try{const file=join(process.cwd(),'data','nba-public-cache-seed.json');if(statSync(file).size<=MAX_BYTES)document=JSON.parse(readFileSync(file,'utf8'));}catch{}
  reader=createNbaSeedReader(document);
 }
 return reader(kind,key,maxAge);
}
const captured=new Map<string,NbaSeedEntry>();let capturedBytes=0;
export function recordNbaSeed(kind:NbaSeedKind,key:string,data:any,capturedAt=Date.now()){
 if(process.env.YJ_NBA_SEED_CAPTURE!=='1'||!permitted(kind,key)||captured.has(kind+':'+key)||captured.size>=MAX_ROWS)return;
 const text=JSON.stringify(data),bytes=Buffer.byteLength(text);if(bytes>1024*1024||capturedBytes+bytes>14*1024*1024)return;
 captured.set(kind+':'+key,{kind,key,data:JSON.parse(text),capturedAt,sha256:digest(data)});capturedBytes+=bytes;
}
export function exportNbaSeed(){return {schema:1,builtAt:new Date().toISOString(),entries:[...captured.values()]};}
