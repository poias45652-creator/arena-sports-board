import {memberIdentity} from '@/lib/member-identity';
import {headers} from 'next/headers';
import {env} from 'cloudflare:workers';
import {getRawDb} from '@/db';
import {hrConnection} from '@/lib/hr9988-connection';
export const dynamic='force-dynamic';
async function handle(request:Request,mode:'status'|'connect'|'read'){
 const memberId=await memberIdentity();
 if(!memberId)return Response.json({error:'請先登入 Arena。',code:'signin_required'},{status:401,headers:{'Cache-Control':'private, no-store'}});
 try{return await hrConnection(memberId,getRawDb(),(env as unknown as Record<string,string>).TZ_BINDING_KEY,mode);}
 catch{return Response.json({error:'會員資料服務暫時無法使用。'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
export function GET(request:Request){return handle(request,new URL(request.url).searchParams.get('status')==='1'?'status':'read');}
export function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'請從 Arena 網站重新操作。'},{status:403});
 return handle(request,'connect');
}
