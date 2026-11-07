import {api} from '@/server/regional-basketball/api.mjs';
import {archiveEntry,snapshot} from '@/server/regional-basketball/archive.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store','Vary':'Cookie'};
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}){
  const {path}=await params;
  if(path[0]==='data'&&path.at(-1)?.endsWith('.json')){
    if(path.join('/')==='data/context.json'){
      const context=await snapshot('/data/context.json');
      return Response.json({checkedAt:context.checkedAt,injuries:context.injuries},{headers:privateHeaders});
    }
    const data=await archiveEntry(path.join('/'));
    if(data)return new Response(new Uint8Array(data),{headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8','Content-Encoding':'gzip'}});
  }else if(path.length===1)return api(request,snapshot);
  return Response.json({error:'查無此資料'},{status:404,headers:privateHeaders});
}
