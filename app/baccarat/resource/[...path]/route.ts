import {memberResource} from '@/lib/baccarat-workspace';
export const dynamic='force-dynamic';
async function handle(request:Request,context:{params:Promise<{path:string[]}>}){
  const {path}=await context.params;
  if(path.some(p=>!p||p==='.'||p==='..'||!/^[\w.-]+$/.test(p)))return new Response(null,{status:404});
  return memberResource(request,'/'+path.join('/'));
}
export {handle as GET,handle as POST};
