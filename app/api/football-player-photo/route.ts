import {isFootballLeague} from '@/lib/football';
import {footballPlayerPhoto} from '@/lib/football-player-photos';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,id=q.get('player')||'',league=q.get('league')||'';
 if(!/^\d{1,12}$/.test(id)||!isFootballLeague(league))return new Response(null,{status:400,headers:{'Cache-Control':'no-store'}});
 try{const photo=await footballPlayerPhoto(id,league);if(!photo)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 return new Response(Buffer.from(photo.bytes),{headers:{'Content-Type':photo.type,'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response(null,{status:503,headers:{'Cache-Control':'no-store','Retry-After':'5'}});}
}
