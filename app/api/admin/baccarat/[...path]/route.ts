import {sportsAdministrator} from '@/app/admin-access';
import {allowedAdminApi,baccaratAdminRequest} from '@/lib/baccarat-admin';
import {requestOrigin} from '@/lib/request-origin';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
const fail=(message:string,status:number)=>Response.json({ok:false,message,error:message},{status,headers});
async function handle(request:Request,context:{params:Promise<{path:string[]}>}) {
  const {path:parts}=await context.params;
  const path=parts.join('/'),method=request.method;
  if(parts.some(p=>!/^[a-zA-Z0-9-]+$/.test(p))||!allowedAdminApi(method,path))return fail('找不到此功能',404);
  const actor=await sportsAdministrator();
  if(!actor)return fail('僅限體育後台管理員',403);
  let body='';
  if(method!=='GET'){
    if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return fail('請從體育後台操作',403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return fail('請使用 JSON',415);
    try{
      const raw=await request.text();
      if(raw.length>16000)return fail('內容過長',413);
      const value=JSON.parse(raw);
      if(!value||typeof value!=='object'||Array.isArray(value))return fail('輸入格式錯誤',400);
      body=JSON.stringify(value);
    }catch{return fail('輸入格式錯誤',400);}
  }
  try{
    const query=new URL(request.url).search;
    const response=await baccaratAdminRequest(actor,method,'/api/admin/'+path+query,body);
    if(response.headers.get('content-type')?.includes('application/json')){
      return new Response(await response.text(),{status:response.status,headers});
    }
  }catch{}
  return fail('百家樂管理服務暫時無法連線',503);
}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
