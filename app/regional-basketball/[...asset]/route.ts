import {archiveEntry} from '@/server/regional-basketball/archive.mjs';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{asset:string[]}>}){
  const {asset}=await params;
  const key=asset.join('/');
  if(/^(?:players\/(?:nbl|kbl)\/[\w-]+\.webp|assets\/(?:nbl|kbl)-[A-Z]+\.(?:webp|svg))$/.test(key)){
    const bytes=await archiveEntry(key);
    if(bytes)return new Response(new Uint8Array(bytes),{headers:{'Content-Type':key.endsWith('.svg')?'image/svg+xml':'image/webp','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
  }
  return new Response(null,{status:404});
}
