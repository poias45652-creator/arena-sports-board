import {headers} from 'next/headers';
import {getRawDb} from '@/db';
import {GET as hrGET} from '../hr9988/route';
import {GET as sharedGET} from '../super007/route';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const memberId=(await headers()).get('oai-authenticated-user-id');
  if(memberId){const binding=await getRawDb().prepare('SELECT game_url FROM tz_bindings WHERE member_id=?').bind(memberId).first<{game_url:string|null}>();if(binding?.game_url)return hrGET(request);}
  const response=await sharedGET();response.headers.set('Cache-Control','private, no-store');response.headers.set('Vary','Cookie');return response;
 }catch{return Response.json({error:'無法確認個人盤口來源，請稍後重試。',games:[],fetchedAt:null},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
