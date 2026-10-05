import {headers} from 'next/headers';
import {getRawDb} from '@/db';
import {readSession,PLATFORM_ADMIN_USERNAME} from '@/lib/arena-session';
export async function adminIdentity():Promise<'tz'|'ofa'|null>{
 try{const s=await readSession(getRawDb(),(await headers()).get('cookie'));if(s?.memberId?.startsWith('ofa:')&&['dvp0322','dvp038','dvp03068','tzt05','vrv01'].includes(s.username?.toLowerCase()))return 'ofa';
 return s?.memberId?.startsWith('tz:')&&[PLATFORM_ADMIN_USERNAME,'vrvtest01'].filter(Boolean).includes(s.username?.toLowerCase())?'tz':null;}catch{return null;}
}
export async function isSiteAdmin(){return (await adminIdentity())!==null;}
