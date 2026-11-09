import {DELETE as logout} from '@/app/api/session/route';
export async function POST(request:Request) {
  const result=await logout(new Request(request.url,{method:'DELETE',headers:request.headers}));
  if(!result.ok)return result;
  const headers=new Headers(result.headers);headers.set('Location','/login?portal=1');
  return new Response(null,{status:303,headers});
}
