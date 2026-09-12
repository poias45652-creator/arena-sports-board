import {headers} from 'next/headers';
import {env} from 'cloudflare:workers';
import {getRawDb} from '@/db';
import {handleTzBinding} from '@/lib/tz-binding-service';
export const dynamic='force-dynamic';
async function handle(request:Request){
 const memberId=(await headers()).get('oai-authenticated-user-id');
 const secret=(env as unknown as Record<string,string>).TZ_BINDING_KEY;
 return handleTzBinding(request,memberId,getRawDb,secret);
}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
export const DELETE=handle;
