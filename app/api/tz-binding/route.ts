import {trustedOrigin,validOrigin} from '../../../server/auth.mjs';
import {getArenaUser} from '@/lib/arena-user';

import {getRawDb} from '@/db';
import {handleTzBinding} from '@/lib/tz-binding-service';
export const dynamic='force-dynamic';
async function handle(request:Request){
 const memberId=(await getArenaUser())?.id??null;
 const secret=process.env.TZ_BINDING_KEY;
 if(request.method!=='GET'&&!validOrigin(request))return Response.json({error:'請從 Arena 網站重新操作。'},{status:403});
 const canonical=new Request(new URL(new URL(request.url).pathname,trustedOrigin(request)),request);
 return handleTzBinding(canonical,memberId,getRawDb,secret);
}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
export const DELETE=handle;
