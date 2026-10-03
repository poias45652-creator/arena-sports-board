import {AsyncLocalStorage} from 'node:async_hooks';

type Work={active:number;queue:(()=>void)[];pending:Map<string,Promise<any>>};
const requests=new AsyncLocalStorage<Map<string,Work>>();

/** Only completed public data may cross Worker invocations. Pending fetches,
 * response streams and queue continuations belong to their originating request. */
export function withSourceRequest<T>(run:()=>T):T{
 return requests.run(new Map(),run);
}
export function sourceWork(name:string):Work{
 const request=requests.getStore();
 let work=request?.get(name);
 if(!work){work={active:0,queue:[],pending:new Map()};request?.set(name,work);}
 return work;
}
