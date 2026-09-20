import {memberIdentity} from '@/lib/member-identity';
import {headers} from 'next/headers';
import {env} from '@/server/runtime';
import {getRawDb} from '@/db';
import {handleTzBinding} from '@/lib/tz-binding-service';
export const dynamic='force-dynamic';
async function handle(request:Request){
 const memberId=await memberIdentity();
 if(memberId?.startsWith('tz:')&&request.method!=='GET')return Response.json({error:'請登出後重新登入以切換帳號',message:'請登出後重新登入以切換帳號'},{status:409});
 const secret=(env as unknown as Record<string,string>).TZ_BINDING_KEY;
 return handleTzBinding(request,memberId,getRawDb,secret);
}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
export const DELETE=handle;
