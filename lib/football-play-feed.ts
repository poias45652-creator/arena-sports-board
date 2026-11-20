import type {FootballGame} from './football';
import type {CorePitchPlay} from './football-pitch';

type Game=Pick<FootballGame,'league'|'id'>;
type Page={pageCount:number;items:CorePitchPlay[]};
type Snapshot={page:number;before:CorePitchPlay[];items:CorePitchPlay[];expires:number};
const pageSize=40;
const snapshots=new Map<string,Snapshot>();
const pending=new Map<string,Promise<CorePitchPlay[]>>();

async function readPage(path:string,page:number,signal:AbortSignal):Promise<Page>{
  const response=await fetch(`https://sports.core.api.espn.com${path}?limit=${pageSize}&page=${page}`,{cache:'no-store',signal});
  if(!response.ok)throw Error('逐球資料暫時無法取得');
  const data=await response.json();
  if(new URL(data.$ref).pathname!==path||data.pageIndex!==page||!Number.isSafeInteger(data.pageCount)||
      data.pageCount<0||!Array.isArray(data.items)||data.items.length>pageSize)throw Error('逐球資料格式不符');
  return data;
}

export function liveFootballPlays(game:Game):Promise<CorePitchPlay[]>{
  const path=`/v2/sports/soccer/leagues/${game.league}/events/${game.id}/competitions/${game.id}/plays`;
  const previous=snapshots.get(path);
  if(previous&&previous.expires>Date.now())return Promise.resolve(previous.items);
  const active=pending.get(path);
  if(active)return active;
  const task=(async()=>{
    let page=previous?.page??1;
    let before=previous?.before??[];
    let items=previous?.items??[];
    let ttl=4000;
    try{
      const signal=AbortSignal.timeout(10000);
      const first=await readPage(path,page,signal);
      const lastPage=Math.max(1,first.pageCount);
      const last=lastPage===page?first:await readPage(path,lastPage,signal);
      // At rollover, retain the previous page's tail until the new page fills up.
      if(lastPage!==page)before=lastPage===page+1?first.items.slice(-10):[];
      items=[...before,...last.items].slice(-pageSize);
      page=lastPage;
    }catch{
      // A missing optional feed must not take down the score and match commentary.
      ttl=10000;
      page=1;
      before=[];
    }
    snapshots.delete(path);
    snapshots.set(path,{page,before,items,expires:Date.now()+ttl});
    if(snapshots.size>100)snapshots.delete(snapshots.keys().next().value!);
    return items;
  })().finally(()=>pending.delete(path));
  pending.set(path,task);
  return task;
}
