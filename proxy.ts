import {NextRequest,NextResponse} from 'next/server';
import {readUser,validOrigin} from './server/auth.mjs';
export async function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(path==='/api/health'||path==='/health'||path==='/api/meta'||path.startsWith('/api/auth/'))return NextResponse.next();
 if(!['GET','HEAD','OPTIONS'].includes(request.method)&&!validOrigin(request))return NextResponse.json({error:'請從 Arena 網站重新操作。'},{status:403});
 try{
  const user=await readUser(request);
  if(user)return NextResponse.next();
  if(path.startsWith('/api/'))return NextResponse.json({error:'請先登入 Arena。',code:'signin_required'},{status:401,headers:{'Cache-Control':'private, no-store'}});
  const login=new URL('/login',request.url);login.searchParams.set('return_to',path+request.nextUrl.search);return NextResponse.redirect(login);
 }catch{return NextResponse.json({error:'Arena 暫時無法連接資料庫，請稍後重試。'},{status:503});}
}
export const config={matcher:['/','/admin/:path*','/teams/:path*','/api/:path*','/health']};
