import {getRawDb} from '@/db';
import {platformIdentity,tableAccess} from '@/lib/platform-access';
import {pickerHtml} from './template';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie','Content-Type':'text/html; charset=utf-8'};
export async function GET(request:Request) {
  try {
    const user=await platformIdentity(getRawDb(),request.headers.get('cookie'));
    if(!user)return new Response(null,{status:303,headers:{...headers,Location:'/login?portal=1'}});
    let table=false,unavailable=false;
    if(user.canCheckTable){try{table=(await tableAccess(user.username)).allowed;}catch{unavailable=true;}}
    if(!user.sports&&!table)return new Response(unavailable?'百家樂權限暫時無法確認，請稍後再試。':'會員尚未取得平台授權。<a href="/login?portal=1">返回登入</a>',{status:unavailable?503:403,headers});
    const choices=[['DG','DG ｜ DG 遊戲平台（預設）',table],['MT','MT ｜ MT 遊戲平台',table],['SPORTS','體育網站',user.sports]] as const;
    const preferred=new URL(request.url).searchParams.get('platform');
    const selected=choices.find(([id,,allowed])=>allowed&&id===preferred)?.[0]||choices.find(c=>c[2])![0];
    const options=choices.map(([id,label,allowed])=>`<option value="${id}"${id===selected?' selected':''}${allowed?'':' disabled'}>${label}${allowed?'':unavailable&&id!=='SPORTS'?'（無法確認）':'（未開通）'}</option>`).join('');
    return new Response(pickerHtml.replace('PLATFORM_OPTIONS',options).replace('ACCESS_STATUS',unavailable?'<p role="status">百家樂權限暫時無法確認</p>':''),{headers});
  }catch{return new Response('登入狀態暫時無法驗證，請稍後再試。',{status:503,headers});}
}
