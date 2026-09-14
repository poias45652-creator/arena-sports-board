import { requireChatGPTUser } from '../chatgpt-auth';
import AdminTools from './tools';
import LogoutButton from '../logout-button';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await requireChatGPTUser('/admin');
  if (user.role !== 'admin') return <main className="mx-auto max-w-3xl space-y-4 px-5 py-10"><h1 className="text-2xl font-bold">僅限管理者存取</h1><p>目前登入的帳號沒有後台權限。</p><LogoutButton label="登出並切換帳號"/><p><a href="/" className="underline">返回前台</a></p></main>;
  return <main className="mx-auto max-w-[1440px] space-y-5 px-5 py-8"><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-black">Arena 管理後台</h1><div className="flex items-center gap-4"><a href="/" className="text-sm underline">返回前台</a><LogoutButton/></div></div><AdminTools/></main>;
}
