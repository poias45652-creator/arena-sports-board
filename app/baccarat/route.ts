import {memberResource} from '@/lib/baccarat-workspace';
export const dynamic='force-dynamic';
export function GET(request:Request){
  if(!['DG','MT'].includes(new URL(request.url).searchParams.get('platform')||''))return new Response(null,{status:303,headers:{Location:'/platforms','Cache-Control':'no-store'}});
  return memberResource(request,'/index.html');
}
