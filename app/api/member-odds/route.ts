import {memberIdentity} from '@/lib/member-identity';
import {headers} from 'next/headers';
import {getRawDb} from '@/db';
import {GET as hrGET} from '../hr9988/route';
import {GET as sharedGET} from '../super007/route';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const league=new URL(request.url).searchParams.get('league');
  if(league&&!['CPBL','NPB','KBO'].includes(league))return Response.json({error:'不支援的聯盟'},{status:400});
  async function scoped(response:Response){
   if(!league)return response;
   const d=await response.json();
   return Response.json({...d,games:(d.internationalGames||[]).filter((g:any)=>g.league===league),internationalGames:undefined,league,error:d.error||(!Array.isArray(d.internationalGames)?'目前資料來源只提供美棒，請連接自己的 SUPER 資料。':null)}, {status:response.status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
  }

  const memberId=await memberIdentity();
  if(memberId){const binding=await getRawDb().prepare('SELECT game_url FROM tz_bindings WHERE member_id=?').bind(memberId).first<{game_url:string|null}>();if(binding?.game_url)return scoped(await hrGET(request));}
  const response=await sharedGET();response.headers.set('Cache-Control','private, no-store');response.headers.set('Vary','Cookie');return scoped(response);
 }catch{return Response.json({error:'無法確認個人資料來源，請稍後重試。',games:[],fetchedAt:null},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
