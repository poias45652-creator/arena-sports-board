import {headers} from 'next/headers';
import {getRawDb} from '@/db';
import {readSession,PLATFORM_ADMIN_USERNAME} from '@/lib/arena-session';
async function currentAdmin(){
 try{const s=await readSession(getRawDb(),(await headers()).get('cookie'));if(s?.memberId?.startsWith('ofa:')&&['dvp0322','dvp038','dvp03068','tzt05','vrv01'].includes(s.username?.toLowerCase()))return {kind:'ofa' as const,username:s.username};
 return s?.memberId?.startsWith('tz:')&&[PLATFORM_ADMIN_USERNAME,'vrvtest01'].filter(Boolean).includes(s.username?.toLowerCase())?{kind:'tz' as const,username:s.username}:null;}catch{return null;}
}
export async function adminIdentity(){return (await currentAdmin())?.kind??null;}
export async function sportsAdministrator(){return (await currentAdmin())?.username??null;}
export async function isSiteAdmin(){return (await adminIdentity())!==null;}
