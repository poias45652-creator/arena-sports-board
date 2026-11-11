// Only used by the local Render HTTP smoke server, with its isolated database.
import './render-http-preload.mjs';
import {createHmac} from 'node:crypto';

const localFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (['localhost', '127.0.0.1'].includes(url.hostname)) return localFetch(input, init);
  if (url.origin==='https://xingzhun-original-test.onrender.com') {
    const req=new Request(input,init);
    const actor=req.headers.get('x-xz-admin-actor');
    const message=['xz-sports-admin-v1',req.headers.get('x-xz-admin-time'),actor,req.method,url.pathname+url.search,await req.text()].join('\n');
    const mac=createHmac('sha256',process.env.XZ_PLATFORM_BRIDGE_KEY).update(message).digest('hex');
    if(!['vrv01','render-test-admin'].includes(actor)||req.headers.get('x-xz-admin-signature')!==mac)return new Response(null,{status:403});
    if(url.pathname==='/api/health')return Response.json({ok:true,activeRelays:3});
    if(url.pathname==='/api/admin/users')return Response.json({ok:true,users:[],stats:{total:0}});
    if(url.pathname==='/api/admin/agents')return Response.json({ok:true,groups:[]});
    if(url.pathname==='/api/admin/platform-members')return Response.json({available:{sports:true,baccarat:true},members:[]});
    if(url.pathname.startsWith('/api/admin/'))return Response.json({ok:true});
    return new Response('<html><head></head><body><main class="admin-app"><aside class="sidebar"><nav class="nav">原百家導覽</nav><button id="logout">登出</button></aside><section class="content"><h1>範例管理內容</h1><p id="result"></p><a href="/api/health">服務狀態</a></section></main><script>fetch("/api/admin/dashboard-data").then(r=>r.json()).then(d=>document.querySelector("#result").textContent=d.ok?"資料已載入":"讀取失敗")</script></body></html>',{headers:{'content-type':'text/html'}});
  }
  if (url.href !== 'https://www.ofa1188.net/api/v1/login') return new Response(null, {status: 503});
  const request = new Request(input, init);
  if (request.method !== 'POST') return new Response(null, {status: 405});
  const {username, password} = await request.json();
  if (username !== 'vrv01' || password !== 'local-fixture-only') return new Response(null, {status: 401});
  const claims = Buffer.from(JSON.stringify({exp: Math.floor(Date.now() / 1000) + 3600})).toString('base64url');
  return Response.json({code: 200, data: {username, user_id: 'smoke-admin', token: 'fixture.' + claims + '.test'}});
};
