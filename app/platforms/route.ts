import {getRawDb} from '@/db';
import {platformIdentity,tableAccess} from '@/lib/platform-access';
import {isSiteAdmin} from '@/app/admin-access';
import {adminHome} from '@/lib/admin-navigation';
import {pickerHtml} from './template';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie','Content-Type':'text/html; charset=utf-8'};
export async function GET(request:Request) {
  try {
    const user=await platformIdentity(getRawDb(),request.headers.get('cookie'));
    const query=new URL(request.url).searchParams;
    if(query.get('check')==='baccarat'){
      const cache={'Cache-Control':'private, no-store',Vary:'Cookie'};
      if(!user)return Response.json({error:'請重新登入'},{status:401,headers:cache});
      try {
        const allowed=user.canCheckTable&&(await tableAccess(user.username)).allowed;
        return Response.json({allowed},{headers:cache});
      }catch{return Response.json({error:'百家樂授權服務暫時未回應'},{status:503,headers:cache});}
    }
    if(!user)return new Response(null,{status:303,headers:{...headers,Location:'/login?portal=1'}});
    let table=false,unavailable=false;
    if(user.canCheckTable){try{table=(await tableAccess(user.username,undefined,true)).allowed;}catch{unavailable=true;}}
    if(!user.sports&&!table&&!unavailable)return new Response('會員尚未取得平台授權。<a href="/login?portal=1">返回登入</a>',{status:403,headers});
    const choices=[['DG','DG ｜ DG 遊戲平台（預設）',table],['MT','MT ｜ MT 遊戲平台',table],['SPORTS','體育網站',user.sports]] as const;
    const preferred=query.get('platform');
    const selected=choices.find(([id,,allowed])=>allowed&&id===preferred)?.[0]||choices.find(c=>c[2])?.[0];
    const options=choices.map(([id,label,allowed])=>`<option value="${id}" data-label="${label}"${id===selected?' selected':''}${allowed?'':' disabled'}>${label}${allowed?'':unavailable&&id!=='SPORTS'?'（確認中）':'（未開通）'}</option>`).join('');
    const status=unavailable?'<p id="table-status" role="status">正在確認百家樂權限… <a href="/platforms">重新確認</a></p>':'';
    const adminLink=user.sports&&await isSiteAdmin()?`<a class="portal-admin-home" href="${adminHome}">管理後台</a>`:'';
    return new Response(pickerHtml.replace('ADMIN_HOME_LINK',adminLink).replace('PLATFORM_OPTIONS',options).replace('SUBMIT_STATE',selected?'':'disabled').replace('ACCESS_STATUS',status),{headers});
  }catch{return new Response('登入狀態暫時無法驗證，請稍後再試。',{status:503,headers});}
}
