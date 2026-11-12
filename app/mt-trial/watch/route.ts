import {activeGameGrant} from '@/lib/mt-trial-access';
import {canonicalGuestIp} from '@/lib/mt-trial-limit';
import {requestOrigin} from '@/lib/request-origin';

export const dynamic='force-dynamic';
type Channel={ip:string;until:number;socket:WebSocket;stop:()=>void};
const channels=new Map<string,Channel>();
const pending=new Set<string>();
const rooms=/^BAV(?:0[1235](?:_LIVE)?|03A(?:_LIVE)?|0[6789]|10)$/;
const scope='/api/v1/gametype/*/game/*/';
const cache={'Cache-Control':'private, no-store'};
function idOf(request:Request){
  const id=new URL(request.url).searchParams.get('id')??'';
  return /^[a-f0-9-]{36}$/i.test(id)?id:'';
}
function projectAction(input:any) {
  // Reconstruct each read-only request. Never forward an arbitrary action,
  // path, credentials, or a transaction from the public guest endpoint.
  const name=input?.action?.name;
  if(name==='/api/v1/member/me'||name==='/api/v1/ping')return {method:'POST',action:{name,lang:'zhtw'}};
  if(name===scope+'room/*/tables')return {method:'GET',action:{name,data:{gametype_id:3,game_id:1,room_id:1}}};
  if(name===scope+'room/*/tablesvg')return {method:'POST',action:{name,data:{}}};
  if(name===scope+'room/*/mulitple_join'){
    const ids=String(input.action.data?.table_id??'').split(',');
    if(!ids.length||ids.length>15||!ids.every(id=>rooms.test(id)))return null;
    return {method:'GET',action:{name,data:{table_id:ids.join(',')}}};
  }
  if(name===scope+'bet/history'){
    const body=input.body;
    if(!body||!Number.isInteger(body.cur)||body.cur<1||body.cur>500||!/^\d{4}-\d\d-\d\dT00:00:00\.000Z$/.test(body.begin_at)||body.end_at!==body.begin_at.slice(0,10)+'T23:59:59.000Z')return null;
    const since=Date.parse(body.begin_at);
    if(!Number.isFinite(since)||Math.abs(since-Date.now())>48*3600000)return null;
    return {method:'GET',action:{name,path:'/api/v1/gametype/3/game/1/bet/history',game_id:1,gametype_id:3},body:{begin_at:body.begin_at,end_at:body.end_at,cur:body.cur,s:8,room_id:1,table_id:0}};
  }
  return null;
}
export async function GET(request:Request) {
  const id=idOf(request);
  if(!id||pending.has(id)||channels.has(id))return new Response(null,{status:400,headers:cache});
  pending.add(id);
  try {
    const grant=await activeGameGrant(request);
    if(grant instanceof Response)return grant;
    const token=[...grant.url.searchParams].find(([key])=>key.toLowerCase()==='token')?.[1];
    if(!token)return new Response(null,{status:503,headers:cache});
    const duration=grant.lease.expiresAt!-grant.lease.serverNow;
    if(duration<=0)return new Response(null,{status:410,headers:cache});
    if(request.signal.aborted || [...channels.values()].filter(c=>c.ip===grant.ip).length>=4)return new Response(null,{status:429,headers:cache});
    const socket=new WebSocket('wss://a1.ofalive99.net/game/ws');
    let stop=()=>{};
    const stream=new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder=new TextEncoder();
        let closed=false;
        const timer=setTimeout(()=>stop(),duration);
        stop=()=>{
          if(closed)return;
          closed=true;clearTimeout(timer);channels.delete(id);
          request.signal.removeEventListener('abort',stop);
          try{socket.close();}catch{}
          try{controller.close();}catch{}
        };
        channels.set(id,{ip:grant.ip,until:performance.now()+duration,socket,stop});
        request.signal.addEventListener('abort',stop,{once:true});
        socket.onclose=stop;socket.onerror=stop;
        socket.onopen=()=>{
          if(closed)return;
          socket.send(JSON.stringify({method:'POST',action:{name:'/api/v1/authenticate',path:'/api/v1/authenticate'},body:{type:3,token}}));
        };
        socket.onmessage=e=>{
          if(closed||typeof e.data!=='string')return;
          try {
            const data=JSON.parse(e.data);
            const safe=JSON.stringify(data,(key,value)=>/token|password|secret/i.test(key)?undefined:value);
            if(safe.includes(token))return;
            controller.enqueue(encoder.encode('data: '+safe+'\n\n'));
          } catch {}
        };
        controller.enqueue(encoder.encode(': connected\n\n'));
      },
      cancel(){stop();}
    });
    return new Response(stream,{headers:{...cache,'Content-Type':'text/event-stream','X-Accel-Buffering':'no'}});
  }finally{pending.delete(id);}
}
export async function POST(request:Request) {
  if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return new Response(null,{status:403});
  const channel=channels.get(idOf(request));
  if(!channel||channel.ip!==canonicalGuestIp(request.headers))return new Response(null,{status:403});
  if(performance.now()>=channel.until){channel.stop();return new Response(null,{status:410});}
  if(!request.headers.get('content-type')?.startsWith('application/json')||Number(request.headers.get('content-length'))>4096)return new Response(null,{status:400});
  try {
    const body=await request.text();
    if(body.length>4096)return new Response(null,{status:400});
    const action=projectAction(JSON.parse(body));
    if(!action||channel.socket.readyState!==WebSocket.OPEN)return new Response(null,{status:400});
    channel.socket.send(JSON.stringify(action));
    return new Response(null,{status:204,headers:cache});
  }catch{return new Response(null,{status:400});}
}
