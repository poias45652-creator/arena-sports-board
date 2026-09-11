import { requireChatGPTUser, chatGPTSignOutPath } from '../chatgpt-auth';
import { isSiteAdmin } from '../admin-access';
import AdminTools from './tools';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireChatGPTUser('/admin');
  if (!(await isSiteAdmin())) return <main className="mx-auto max-w-3xl space-y-4 px-5 py-10"><h1 className="text-2xl font-bold">僅限管理者存取</h1><p>目前登入的帳號沒有後台權限。</p><a className="underline" href={chatGPTSignOutPath('/admin')} target="_top">登出並切換帳號</a><p><a href="/" className="underline">返回前台</a></p></main>;
  return <main className="mx-auto max-w-[1440px] space-y-5 px-5 py-8"><div className="flex items-center justify-between gap-4"><h1 className="text-2xl font-black">Arena 管理後台</h1><a href="/" className="text-sm underline">返回前台</a></div><AdminTools/></main>;
}
