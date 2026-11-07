import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {viewerToken} from '@/lib/arena-session';

export const dynamic='force-dynamic';
export async function GET(request:Request){
  const url=new URL(request.url);
  if(!['NBL','KBL'].includes(url.searchParams.get('league')||''))return new Response(null,{status:404});
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Sec-Fetch-Dest'};
  if(request.headers.get('Sec-Fetch-Dest')==='document')return new Response(null,{status:307,headers:{...headers,Location:'/'+url.search}});
  const html=await readFile(join(process.cwd(),'server/regional-basketball/board.html'),'utf8');
  return new Response(html.replace('__VIEW_ONLY__',String(!!viewerToken(request.headers.get('cookie')))),{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"frame-ancestors 'self'",'X-Frame-Options':'SAMEORIGIN'}});
}
