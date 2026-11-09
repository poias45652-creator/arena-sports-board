import {sportsAdministrator} from '@/app/admin-access';
import {baccaratAdminRequest,baccaratSections,sportsAdminDocument} from '@/lib/baccarat-admin';

export const dynamic='force-dynamic';
export async function GET(_request:Request,context:{params:Promise<{section:string}>}) {
  const {section}=await context.params;
  const headers={'Cache-Control':'private, no-store','Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
  if(!Object.hasOwn(baccaratSections,section))return new Response('找不到此功能',{status:404,headers});
  const actor=await sportsAdministrator();
  if(!actor)return new Response('僅限體育後台管理員。<a href="/login?admin=1">管理員登入</a>',{status:403,headers});
  try{
    const response=await baccaratAdminRequest(actor,'GET','/admin/'+section);
    if(response.status===200&&response.headers.get('content-type')?.includes('text/html')){
      return new Response(sportsAdminDocument(await response.text()),{headers});
    }
  }catch{}
  return new Response('百家樂管理服務暫時無法連線。<a href="/admin">返回體育後台</a>',{status:503,headers});
}
