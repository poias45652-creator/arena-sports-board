import {trustedOrigin,validOrigin} from '../../../server/auth.mjs';
import {getArenaUser} from '@/lib/arena-user';

import {getRawDb} from '@/db';
import {hrConnection} from '@/lib/hr9988-connection';
export const dynamic='force-dynamic';
async function handle(request:Request,mode:'status'|'connect'|'read'){
 const memberId=(await getArenaUser())?.id??null;
 if(!memberId)return Response.json({error:'請先登入 YJ體育分析。',code:'signin_required'},{status:401,headers:{'Cache-Control':'private, no-store'}});
 try{return await hrConnection(memberId,getRawDb(),process.env.TZ_BINDING_KEY,mode);}
 catch{return Response.json({error:'會員盤口服務暫時無法使用。'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
export function GET(request:Request){return handle(request,new URL(request.url).searchParams.get('status')==='1'?'status':'read');}
export function POST(request:Request){
 if(!validOrigin(request))return Response.json({error:'請從 YJ體育分析 網站重新操作。'},{status:403});
 return handle(request,'connect');
}
