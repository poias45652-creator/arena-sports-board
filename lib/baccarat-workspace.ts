import {createHash,createHmac} from 'node:crypto';
import {getRawDb} from '../db';
import {platformIdentity} from './platform-access';
import {requestOrigin} from './request-origin';

const native='https://xingzhun-original-test.onrender.com';
export async function memberResource(request:Request,path:string) {
  const method=request.method;
  const asset=/^\/assets\/[\w.-]+\.(?:js|css|png|jpe?g|webp|svg|woff2?|gif|mp4|ico)$/.test(path);
  const read=asset||['/index.html','/api/metrix/panel-access','/api/metrix/system-state','/api/mt/public-roads','/METRIX_dynamic_fullframe_motion_matched_v15_rotating_disk.mp4'].includes(path);
  const write=/^\/api\/(?:metrix\/session\/(?:start|heartbeat|permissions|logout)|xingzhun\/audit\/(?:batch|export|snapshot|history)|mt\/connection-event)$/.test(path);
  const cache={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  if(!((method==='GET'&&read)||(method==='POST'&&write)))return new Response(null,{status:404,headers:cache});
  if(method==='POST'&&(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site'||!request.headers.get('content-type')?.startsWith('application/json')))return new Response(null,{status:403,headers:cache});
  try {
    const member=await platformIdentity(getRawDb(),request.headers.get('cookie'));
    if(!member)return path==='/index.html'?new Response(null,{status:303,headers:{...cache,Location:'/platforms'}}):Response.json({message:'請登入星準'},{status:401,headers:cache});
    if(!member.canCheckTable)return Response.json({message:'尚未取得百家樂授權'},{status:403,headers:cache});
    const key=process.env.XZ_PLATFORM_BRIDGE_KEY;
    if(!key||key.length<40)throw Error('missing service');
    if(write&&Number(request.headers.get('content-length'))>2097152)return new Response(null,{status:413,headers:cache});
    const body=write?await request.arrayBuffer():undefined;
    if(body&&body.byteLength>2097152)return new Response(null,{status:413,headers:cache});
    const bodyHash=createHash('sha256').update(body?Buffer.from(body):'').digest('hex');
    const actor=Buffer.from(member.username).toString('base64url'),time=String(Date.now());
    const mac=createHmac('sha256',key).update(['member-resource-v1',time,actor,method,path,bodyHash].join('\n')).digest('hex');
    const headers=new Headers({'Origin':native,'x-xz-member':actor,'x-xz-member-time':time,'x-xz-member-signature':mac,'x-xz-member-content':bodyHash});
    if(write)headers.set('Content-Type','application/json');
    if(path.startsWith('/api/xingzhun/audit/'))headers.set('X-Xingzhun-Audit-Key',createHmac('sha256',key).update('member-audit:'+member.memberId).digest('hex'));
    if(request.headers.has('range'))headers.set('Range',request.headers.get('range')!);
    const r=await fetch(native+path,{method,body,headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(22000)});
    const out=new Headers(cache);
    for(const h of ['content-type','content-range','accept-ranges'])if(r.headers.has(h))out.set(h,r.headers.get(h)!);
    if(asset&&r.ok)out.set('cache-control','private, max-age=3600');
    if(path==='/index.html')out.set('Referrer-Policy','no-referrer');
    return new Response(r.body,{status:r.status,headers:out});
  }catch{return Response.json({message:'百家樂服務暫時無法連線，請稍後重試'},{status:503,headers:cache});}
}
