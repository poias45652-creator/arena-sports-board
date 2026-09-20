import {getChatGPTUser} from './chatgpt-auth';
import {headers} from 'next/headers';
import {getRawDb} from '@/db';
import {readSession,PLATFORM_ADMIN_USERNAME} from '@/lib/arena-session';

// TZ usernames here come only from a live server-verified session and binding.
export async function adminIdentity():Promise<'chatgpt'|'tz'|null>{
 const user=await getChatGPTUser();
 if(user?.email.toLowerCase()==='admin@example.invalid')return 'chatgpt';
 try{
  const session=await readSession(getRawDb(),(await headers()).get('cookie'));
  return session?.username?.toLowerCase()===PLATFORM_ADMIN_USERNAME?'tz':null;
 }catch{return null;}
}
export async function isSiteAdmin(){return (await adminIdentity())!==null;}
