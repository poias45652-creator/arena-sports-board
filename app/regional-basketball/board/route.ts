import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {adminIdentity} from '@/app/admin-access';
import {viewerToken} from '@/lib/arena-session';

export const dynamic='force-dynamic';
export async function GET(request:Request){
  const url=new URL(request.url);
  if(!['NBL','KBL'].includes(url.searchParams.get('league')||''))return new Response(null,{status:404});
  const admin=url.searchParams.get('admin')==='1';
  if(admin&&!await adminIdentity())return new Response(null,{status:403,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Sec-Fetch-Dest'};
  if(request.headers.get('Sec-Fetch-Dest')==='document')return new Response(null,{status:307,headers:{...headers,Location:(admin?'/admin/regional-basketball':'/')+url.search}});
  const html=await readFile(join(process.cwd(),'server/regional-basketball/board.html'),'utf8');
  return new Response(html.replace('__ADMIN_VIEW__',String(admin)).replace('__VIEW_ONLY__',String(!!viewerToken(request.headers.get('cookie')))),{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"frame-ancestors 'self'",'X-Frame-Options':'SAMEORIGIN'}});
}
