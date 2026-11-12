import {randomBytes} from 'node:crypto';
import {getPool} from '../../../server/database.mjs';
import {canonicalGuestIp,createRetestClaim} from '../../../lib/mt-trial-limit';
import {requestOrigin} from '../../../lib/request-origin';

export const dynamic='force-dynamic';
const claim=createRetestClaim({query:(sql,args)=>getPool().query(sql,args)});
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'};

function page(body:string,status=200,nonce=randomBytes(16).toString('base64')) {
  return new Response(`<!DOCTYPE html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>星準｜MT 試玩</title><style>body{margin:0;background:#071d1b;color:#f8e9cc;font:17px/1.6 system-ui;min-height:100svh;display:grid;place-items:center}main{padding:24px;text-align:center}button,a{font:inherit;color:#182520;background:#f1cc83;padding:.6em 1em;border:none;border-radius:8px}button:disabled{opacity:.5}</style><main><p>星準 · MT 百家樂</p>${body}</main></html>`,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`}});
}

export function GET(){
  const nonce=randomBytes(16).toString('base64');
  return page(`<h1>再試玩一次</h1><p id="msg">開放後，在牌桌按「開始 10 分鐘試玩」才會計時。</p><form method="post" action="/mt-trial/retest"><input name="code" type="hidden"><button disabled>開放本次測試</button></form><script nonce="${nonce}">const c=location.hash.slice(1);if(/^[a-f0-9]{64}$/.test(c)){document.querySelector('input').value=c;document.querySelector('button').disabled=false}else{document.querySelector('#msg').textContent='請開啟專用測試連結。'}</script>`,200,nonce);
}
export async function POST(request:Request) {
  if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return page('<p>請從專用連結開啟。</p>',403);
  const ip=canonicalGuestIp(request.headers);
  if(!ip)return page('<p>暫時無法辨識連線。</p>',503);
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')||Number(request.headers.get('content-length'))>256)return page('<p>連結格式無效。</p>',400);
  try {
    const code=new URLSearchParams(await request.text()).get('code')||'';
    if(!await claim(ip,code))return page('<h1>此連結已失效</h1><a href="/mt-trial">查看試玩資格</a>',410);
    return new Response(null,{status:303,headers:{...headers,Location:'/mt-trial'}});
  } catch{return page('<p>暫時無法開放，請稍後再試。</p>',503);}
}
