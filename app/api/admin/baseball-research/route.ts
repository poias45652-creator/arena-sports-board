import {requestOrigin} from '@/lib/request-origin';
import {getRawDb} from '@/db';
import {isSiteAdmin} from '@/app/admin-access';
import {importExistingResearch,listResearch} from '@/server/baseball-research.mjs';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 const p=new URL(request.url).searchParams;
 try{return reply(await listResearch(getRawDb(),p.get('section')||'research',p.get('league')||''));}
 catch{return reply({error:'研究資料讀取失敗，請稍後再試。'},503);}
}
export async function POST(request:Request){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'請從管理後台操作'},403);
 try{return reply(await importExistingResearch(getRawDb()));}
 catch(error){return reply({error:'補入或讀回尚未完成，可安全重試。',receipt:(error as any)?.receipt??null},503);}
}
