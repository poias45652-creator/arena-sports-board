/* Independent careers. Existing keys and original bytes survive upgrades and new games. */
(function(root){
'use strict';
const INDEX='xingzhun-saves-v1',PREFIX='xingzhun-save-',ACTIVE='xingzhun-active-save-';
function createStore(storage,idFactory,now=()=>Date.now()){
 const validId=id=>typeof id==='string'&&/^[A-Za-z0-9-]{1,100}$/.test(id);
 function list(){const raw=storage.getItem(INDEX);if(!raw)return[];const entries=JSON.parse(raw);if(!Array.isArray(entries))throw Error('Invalid save catalog');return entries.filter(e=>e&&validId(e.id)&&Number.isInteger(e.sport)&&e.sport>=0&&e.sport<=2)}
 function freshId(){for(let tries=0;tries<100;tries++){const id=idFactory();if(validId(id)&&storage.getItem(PREFIX+id)===null)return id}throw Error('Cannot create save ID')}
 function raw(id){return validId(id)?storage.getItem(PREFIX+id):null}
 function backup(id){return validId(id)?storage.getItem('xingzhun-original-'+id):null}
 function metadata(state,id,sport){return{id,sport,name:String(state.name||'舊生涯').slice(0,16),pos:String(state.pos||''),age:Number(state.age)||16,team:String(state.team||'高中校隊'),retired:!!state.retired,chapter:state.reason==='chapter',updatedAt:now()}}
 function transaction(changes){
  const prior=new Map([...changes.keys()].map(k=>[k,storage.getItem(k)])),done=[];
  try{for(const [k,v]of changes){storage.setItem(k,v);done.push(k)}}
  catch(error){for(const k of done.reverse()){try{const v=prior.get(k);if(v===null)storage.removeItem(k);else storage.setItem(k,v)}catch{}}throw error}
 }
 function persist(serialized,state,id,sport,legacy=false){
  const entries=list(),old=raw(id),changes=new Map();
  if(old!==null&&backup(id)===null)changes.set('xingzhun-original-'+id,old);
  changes.set(PREFIX+id,serialized);
  changes.set(INDEX,JSON.stringify([metadata(state,id,sport),...entries.filter(e=>e.id!==id)]));
  changes.set(ACTIVE+sport,id);
  if(legacy){const previous=storage.getItem('triple-'+sport),key='xingzhun-backup-v1-'+sport;if(previous!==null&&storage.getItem(key)===null)changes.set(key,previous);changes.set('triple-'+sport,serialized);changes.set('triple-last',String(sport))}
  transaction(changes);return id;
 }
 function ensureLegacy(sport){const legacy=storage.getItem('triple-'+sport);if(!legacy)return null;const id=storage.getItem(ACTIVE+sport);if(validId(id)&&list().some(e=>e.id===id&&e.sport===sport)&&raw(id)!==null)return id;let state;try{state=JSON.parse(legacy)||{}}catch{state={}}return persist(legacy,state,freshId(),sport)}
 function migrateAll(){for(let sport=0;sport<3;sport++)ensureLegacy(sport);return list()}
 function write(state,id){ensureLegacy(state.sport);const existing=list().find(e=>e.id===id);if(!validId(id)||!existing||existing.sport!==state.sport)id=freshId();return persist(JSON.stringify(state),state,id,state.sport,true)}
 function create(state){return write(state,null)}
 function inherit(parent,parentId,child){
  const entries=list(),original=raw(parentId),entry=entries.find(e=>e.id===parentId);
  if(!original||!entry||entry.sport!==parent.sport||!parent.retired||parent.reason==='chapter'||!parent.family?.child||child.lineage?.parentId!==parentId||child.sport!==parent.sport)throw Error('Invalid family transition');
  const stored=JSON.parse(original),existing=stored.family?.successorId||parent.family.successorId;
  if(existing){if(!entries.some(e=>e.id===existing)||!raw(existing))throw Error('Missing successor save');return{id:existing,created:false}}
  const id=freshId(),updated=JSON.parse(JSON.stringify(parent));updated.family.successorId=id;
  const changes=new Map();if(backup(parentId)===null)changes.set('xingzhun-original-'+parentId,original);
  changes.set(PREFIX+parentId,JSON.stringify(updated));changes.set(PREFIX+id,JSON.stringify(child));
  changes.set(INDEX,JSON.stringify([metadata(child,id,child.sport),metadata(updated,parentId,parent.sport),...entries.filter(e=>e.id!==parentId)]));
  changes.set(ACTIVE+child.sport,id);
  const oldLegacy=storage.getItem('triple-'+child.sport),backupKey='xingzhun-backup-v1-'+child.sport;
  if(oldLegacy!==null&&storage.getItem(backupKey)===null)changes.set(backupKey,oldLegacy);
  changes.set('triple-'+child.sport,JSON.stringify(child));changes.set('triple-last',String(child.sport));
  transaction(changes);return{id,created:true};
 }
 // Read-only history snapshot for a new random career; no existing bytes are changed.
 function recentStories(){const ids=[];for(const entry of list().slice(0,6)){try{const state=JSON.parse(raw(entry.id));ids.push(...(state.storyMemory?.variants||[]),...(state.recent||[]).slice().reverse(),...(state.fate?.history||[]).slice().reverse().map(h=>h.id),...Object.keys(state.visits||{}))}catch{}}return [...new Set(ids)].filter(id=>typeof id==='string').slice(0,160)}
 // Cached callers also create independent careers.
 return{recentStories,list,raw,backup,freshId,ensureLegacy,migrateAll,write,create,inherit,replaceSport:create};
}
const api={createStore};if(typeof module!=='undefined')module.exports=api;else root.XZSaves=api;
})(globalThis);
