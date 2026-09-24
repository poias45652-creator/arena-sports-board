import {memberIdentity} from '@/lib/member-identity';
import {env} from '@/server/runtime';
import {getRawDb} from '@/db';
import {superEntry} from '@/lib/super-entry';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{return await superEntry(request,await memberIdentity(),getRawDb(),(env as unknown as Record<string,string>).TZ_BINDING_KEY);}
 catch{return Response.json({error:'登入服務暫時無法使用。'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
