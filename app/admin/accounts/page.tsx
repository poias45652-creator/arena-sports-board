import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { adminIdentity } from '../../admin-access';
import SessionAccount from '../../session-account';
import Accounts from '../accounts';

export const dynamic = 'force-dynamic';

export default async function AdminAccountsPage() {
  if (!await adminIdentity()) return <main className="mx-auto max-w-3xl space-y-4 px-5 py-10"><h1 className="text-2xl font-bold">僅限管理者存取</h1><p>目前登入的帳號沒有後台權限。</p><a className="underline" href="/login">使用管理員帳號登入</a><p><a href="/" className="underline">返回前台</a></p></main>;

  return <main className="arena-shell min-h-screen text-slate-100">
    <header className="border-b border-white/8 bg-[#081522]/95"><div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center gap-3 px-5 py-3"><a href="/" className="header-action"><ArrowLeft className="size-4"/>返回賽事</a><a href="/admin?view=system" className="header-action">系統管理與設定</a><div className="flex items-center gap-2 font-black"><ShieldCheck className="size-5 text-[#ffd538]"/>星準・帳號授權管理</div><div className="ml-auto"><SessionAccount/></div></div></header>
    <div className="mx-auto max-w-[1440px] space-y-5 px-5 py-8"><Accounts/></div>
  </main>;
}
