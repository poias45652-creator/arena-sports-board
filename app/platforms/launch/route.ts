import {POST as connectSports} from '@/app/api/hr9988/route';
import {requestOrigin} from '@/lib/request-origin';
import {getRawDb} from '@/db';
import {platformIdentity,tableAccess} from '@/lib/platform-access';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Content-Type':'text/html; charset=utf-8','Referrer-Policy':'strict-origin','X-Content-Type-Options':'nosniff'};
export async function POST(request:Request){
  if(request.headers.get('origin')!==requestOrigin(request))return new Response('請從星準選單操作',{status:403,headers});
  const form=await request.formData().catch(()=>null),platform=form?.get('platform');
  if(platform!=='MT'&&platform!=='DG'&&platform!=='SPORTS')return new Response('無效的平台',{status:400,headers});
  try{
    const user=await platformIdentity(getRawDb(),request.headers.get('cookie'));
    if(!user)return new Response('請先登入星準',{status:401,headers});
    if(platform==='SPORTS'){
      if(!user.sports)return new Response('尚未取得體育權限',{status:403,headers});
      if(user.canCheckTable){
        const connection=await connectSports(new Request(request.url,{method:'POST',headers:request.headers}));
        if(connection.status===401)return new Response(null,{status:303,headers:{...headers,Location:'/login?portal=1&reason=tz-expired'}});
      }
      return new Response(null,{status:303,headers:{...headers,Location:'/?league=MLB&view=analysis'}});
    }
    if(!user.canCheckTable||!(await tableAccess(user.username)).allowed)return new Response('尚未取得百家樂權限',{status:403,headers});
    return new Response(null,{status:303,headers:{...headers,Location:'/baccarat?platform='+platform}});
  }catch{return new Response('目前無法確認使用權限，請稍後重試。',{status:503,headers});}
}
