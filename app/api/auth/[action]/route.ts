import {authAction,readUser} from '../../../../server/auth.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){
 try{return await authAction(request,(await params).action);}catch{return Response.json({error:'帳號服務暫時無法使用。'},{status:503});}
}
export async function GET(request:Request,{params}:{params:Promise<{action:string}>}){
 if((await params).action!=='me')return Response.json({error:'找不到此操作。'},{status:404});
 try{const user=await readUser(request);return Response.json({user},{status:user?200:401,headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'帳號服務暫時無法使用。'},{status:503});}
}
