import {sportsAdministrator} from '@/app/admin-access';
import {isBaccaratSection} from '@/lib/admin-navigation';
export const dynamic='force-dynamic';

// A cross-origin bookmark can resume either existing admin session. Neither
// service gives its cookie to the other or grants privileges during navigation.
export async function GET(request:Request) {
  const params=new URL(request.url).searchParams;
  const section=params.get('section')||'members';
  if(!isBaccaratSection(section)) return new Response(null,{status:404});
  const target='/admin/baccarat/'+section;
  let location=target;
  if(!await sportsAdministrator()) {
    location=params.get('native')==='1'?
      'https://xingzhun-original-test.onrender.com/admin/'+section+'?local=1':
      '/login?'+new URLSearchParams({admin:target,from:'baccarat'});
  }
  return new Response(null,{status:303,headers:{Location:location,'Cache-Control':'private, no-store',Vary:'Cookie','Referrer-Policy':'no-referrer'}});
}
