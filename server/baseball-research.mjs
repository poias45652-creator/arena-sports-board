import {createHash} from 'node:crypto';
import history from './research-data/normalized-history.json' with {type:'json'};
import games from './research-data/games-archived-clean.json' with {type:'json'};
import projection from './research-data/research-field-projection.json' with {type:'json'};

export const batchId='yj-existing-20260915-v1';
const projections=new Map(projection.records.map(r=>[r.key,r]));
export function importRows(){
 const rows=history.map(r=>{
  const key=`${r.league}:${r.source_id}:${r.record_id}`;
  const payload=JSON.stringify({original:r.payload,qualityFlags:r.quality_flags,projection:projections.get(key)??null,eligibleForMemberAnalysis:false});
  return {key,league:r.league,section:r.quality==='quarantined'?'quarantine':'research',entity:r.entity_name,observedAt:r.observed_on,sourceAsOf:r.source_as_of_date,sourceUrl:r.source_url,payload};
 });
 for(const g of games.observations){
  if(g.eligibleForCurrentFeed!==false||g.observedGame.status!=='pregame'||g.observedGame.home.score!==null||g.observedGame.away.score!==null)throw Error('Invalid archived observation');
  rows.push({key:`archive:${g.key}:${g.sourceObservedAt}`,league:g.league,section:'archive',entity:`${g.observedGame.away.name} @ ${g.observedGame.home.name}`,observedAt:g.sourceObservedAt,sourceAsOf:null,sourceUrl:g.observedGame.source.url,payload:JSON.stringify(g)});
 }
 if(rows.length!==259||new Set(rows.map(r=>r.key)).size!==259)throw Error('Invalid import identities');
 return rows.map(r=>({...r,hash:createHash('sha256').update(r.payload).digest('hex')}));
}

// This backfill intentionally never updates an existing identity, even on an
// ambiguous same-day timestamp. Newer or edited records always win.
export async function importExistingResearch(db){
 const rows=importRows(),at=new Date().toISOString();
 const receipt={batchId,inserted:0,updated:0,skipped:0,quarantined:0,failed:0,verified:0,preservedDifferent:0,bySection:{research:0,quarantine:0,archive:0},readBackAt:null};
 try{
  for(let offset=0;offset<rows.length;offset+=20){
   const chunk=rows.slice(offset,offset+20);
   const result=await db.batch(chunk.map(r=>db.prepare(`INSERT INTO baseball_research
    (key,league,section,entity,observed_at,source_as_of,source_url,content_hash,payload,imported_at,batch_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO NOTHING`).bind(r.key,r.league,r.section,r.entity,r.observedAt,r.sourceAsOf,r.sourceUrl,r.hash,r.payload,at,batchId)));
   for(let i=0;i<chunk.length;i++){
    if(Number(result[i]?.meta?.changes)>0){receipt.inserted++;receipt.bySection[chunk[i].section]++;if(chunk[i].section==='quarantine')receipt.quarantined++;}
    else receipt.skipped++;
   }
  }
  for(let offset=0;offset<rows.length;offset+=25){
   const chunk=rows.slice(offset,offset+25);
   const result=await db.prepare(`SELECT key,content_hash,payload FROM baseball_research WHERE key IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk.map(r=>r.key)).all();
   const found=new Map(result.results.map(r=>[r.key,r]));
   for(const r of chunk){const saved=found.get(r.key);if(!saved)throw Error('Missing read-back row');
    if(createHash('sha256').update(saved.payload).digest('hex')!==saved.content_hash)throw Error('Read-back integrity mismatch');
    if(saved.content_hash!==r.hash)receipt.preservedDifferent++;
    receipt.verified++;
   }
  }
  receipt.readBackAt=new Date().toISOString();return receipt;
 }catch(error){receipt.failed=rows.length-receipt.inserted-receipt.skipped;throw Object.assign(Error('匯入或讀回尚未完成；可安全重試。'),{receipt,cause:error});}
}

export async function listResearch(db,section='research',league=''){
 if(!['research','quarantine','archive'].includes(section))throw Error('Invalid section');
 if(league&&!['CPBL','NPB','KBO'].includes(league))throw Error('Invalid league');
 const result=await db.prepare('SELECT * FROM baseball_research WHERE section=? AND (?=\'\' OR league=?) ORDER BY league,entity,key LIMIT 300').bind(section,league,league).all();
 const counts=await db.prepare('SELECT section,league,COUNT(*) AS count FROM baseball_research GROUP BY section,league').all();
 return {rows:result.results.map(r=>({...r,payload:JSON.parse(r.payload)})),counts:counts.results};
}
