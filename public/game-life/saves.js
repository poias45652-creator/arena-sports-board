/* Browser-local careers: imports can add slots; starting over replaces all saves for the selected sport. */
(function(root){
'use strict';
const INDEX='xingzhun-saves-v1',PREFIX='xingzhun-save-',ACTIVE='xingzhun-active-save-';
function createStore(storage,idFactory,now=()=>Date.now()){
 const validId=id=>typeof id==='string'&&/^[A-Za-z0-9-]{1,100}$/.test(id);
 function list(){const raw=storage.getItem(INDEX);if(!raw)return[];const entries=JSON.parse(raw);if(!Array.isArray(entries))throw Error('Invalid save catalog');return entries.filter(e=>e&&validId(e.id)&&Number.isInteger(e.sport)&&e.sport>=0&&e.sport<=2)}
 function freshId(){for(;;){const id=idFactory();if(!validId(id))continue;try{if(storage.getItem(PREFIX+id)!==null)continue}catch{}return id}}
 function raw(id){return validId(id)?storage.getItem(PREFIX+id):null}
 function metadata(state,id,sport){return{id,sport,name:String(state.name||'舊生涯').slice(0,16),pos:String(state.pos||''),age:Number(state.age)||16,team:String(state.team||'高中校隊'),retired:!!state.retired,updatedAt:now()}}
 function persist(serialized,state,id,sport){const entries=list(),entry=metadata(state,id,sport),next=[entry,...entries.filter(e=>e.id!==id)];storage.setItem(PREFIX+id,serialized);storage.setItem(INDEX,JSON.stringify(next));storage.setItem(ACTIVE+sport,id);return id}
 function ensureLegacy(sport){const legacy=storage.getItem('triple-'+sport);if(!legacy)return null;const id=storage.getItem(ACTIVE+sport);if(validId(id)&&list().some(e=>e.id===id&&e.sport===sport)&&raw(id)!==null)return id;let state;try{state=JSON.parse(legacy)||{}}catch{state={}}return persist(legacy,state,freshId(),sport)}
 function migrateAll(){for(let sport=0;sport<3;sport++)ensureLegacy(sport);return list()}
 function write(state,id){ensureLegacy(state.sport);const entries=list(),existing=entries.find(e=>e.id===id);if(!validId(id)||existing&&existing.sport!==state.sport)id=freshId();const serialized=JSON.stringify(state);persist(serialized,state,id,state.sport);storage.setItem('triple-'+state.sport,serialized);storage.setItem('triple-last',String(state.sport));return id}
 function replaceSport(state){
  const sport=state.sport,entries=list(),old=entries.filter(e=>e.sport===sport),id=freshId(),serialized=JSON.stringify(state);
  const changes=new Map([[PREFIX+id,serialized],[INDEX,JSON.stringify([metadata(state,id,sport),...entries.filter(e=>e.sport!==sport)])],[ACTIVE+sport,id],['triple-'+sport,serialized],['triple-last',String(sport)],['xingzhun-backup-v1-'+sport,null],...old.map(e=>[PREFIX+e.id,null])]);
  const prior=new Map([...changes.keys()].map(key=>[key,storage.getItem(key)]));
  try{for(const [key,value]of changes){if(value===null)storage.removeItem(key);else storage.setItem(key,value)}}
  catch(error){for(const [key,value]of prior){try{if(value===null)storage.removeItem(key);else storage.setItem(key,value)}catch{}}throw error}
  return id;
 }
 return{list,raw,freshId,ensureLegacy,migrateAll,write,replaceSport};
}
const api={createStore};if(typeof module!=='undefined')module.exports=api;else root.XZSaves=api;
})(globalThis);
