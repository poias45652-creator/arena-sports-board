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
 // Cached callers also create independent careers.
 return{list,raw,backup,freshId,ensureLegacy,migrateAll,write,create,replaceSport:create};
}
const api={createStore};if(typeof module!=='undefined')module.exports=api;else root.XZSaves=api;
})(globalThis);
