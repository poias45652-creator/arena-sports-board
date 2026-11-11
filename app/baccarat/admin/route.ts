import {sportsAdministrator} from '@/app/admin-access';
import {adminHome,isBaccaratSection} from '@/lib/admin-navigation';
export const dynamic='force-dynamic';

// Old dashboard entry links are bookmarks for the admin home. The real
// dashboard remains available at /admin/baccarat/dashboard in the sidebar.
export async function GET(request:Request) {
  const section=new URL(request.url).searchParams.get('section')||'members';
  if(!isBaccaratSection(section)) return new Response(null,{status:404});
  const target=section==='dashboard'||section==='members'?adminHome:'/admin/baccarat/'+section;
  const location=await sportsAdministrator()?target:'/login?'+new URLSearchParams({admin:target});
  return new Response(null,{status:303,headers:{Location:location,'Cache-Control':'private, no-store',Vary:'Cookie','Referrer-Policy':'no-referrer'}});
}
