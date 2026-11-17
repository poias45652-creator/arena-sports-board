import {sportsAdministrator} from '@/app/admin-access';
import {baccaratAdminRequest} from '@/lib/baccarat-admin';
import {requestOrigin} from '@/lib/request-origin';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};

export async function POST(request:Request) {
  if(request.headers.get('origin')!==requestOrigin(request) || request.headers.get('sec-fetch-site')==='cross-site' ||
     request.headers.get('x-mt-publisher')!=='1')return new Response(null,{status:403,headers});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return new Response(null,{status:415,headers});
  const actor=await sportsAdministrator();
  if(!actor)return new Response(null,{status:403,headers});
  if(Number(request.headers.get('content-length'))>32768)return new Response(null,{status:413,headers});
  let hands:unknown;
  try {
    const body=await request.text();
    if(Buffer.byteLength(body)>32768)return new Response(null,{status:413,headers});
    hands=JSON.parse(body);
  }catch{return new Response(null,{status:400,headers});}
  if(!Array.isArray(hands)||!hands.length||hands.length>10)return new Response(null,{status:400,headers});
  try {
    const upstream=await baccaratAdminRequest(actor,'POST','/api/admin/mt-road-observations',JSON.stringify(hands));
    return new Response(null,{status:upstream.status,headers});
  }catch{return new Response(null,{status:503,headers});}
}
