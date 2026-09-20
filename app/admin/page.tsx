import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';
import { chatGPTSignInPath, chatGPTSignOutPath } from '../chatgpt-auth';
import { adminIdentity } from '../admin-access';
import SessionAccount from '../session-account';
import AdminTools from './tools';
import SectionBoundary from './section-boundary';
import TurnstileSettings from './turnstile-settings';
import Accounts from './accounts';
import ResearchPanel from './research-panel';
import CpblMarketStatus from './cpbl-market-status';
import PregameImports from './pregame-imports';
import InternationalMarketStatus from './international-market-status';
import InternationalData from './international-data';
import TwtoolsReference from './twtools-reference';
import InternationalValidation from './international-validation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const identity=await adminIdentity();
  if (!identity) return <main className="mx-auto max-w-3xl space-y-4 px-5 py-10"><h1 className="text-2xl font-bold">僅限管理者存取</h1><p>目前登入的帳號沒有後台權限。</p><a className="underline" href="/login">使用管理員帳號登入</a><p><a className="underline" href={chatGPTSignInPath('/admin')} target="_top">擁有者登入</a></p><p><a href="/" className="underline">返回前台</a></p></main>;
  return <main className="arena-shell min-h-screen text-slate-100">
    <header className="border-b border-white/8 bg-[#081522]/95"><div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center gap-3 px-5 py-3"><a href="/" className="header-action"><ArrowLeft className="size-4"/>返回賽事</a><div className="flex items-center gap-2 font-black"><ShieldCheck className="size-5 text-[#ffd538]"/>YJ體育分析・管理後台</div><div className="ml-auto">{identity==='tz'?<SessionAccount/>:<a href={chatGPTSignOutPath('/')} target="_top" className="header-action"><LogOut className="size-4"/>登出</a>}</div></div></header>
    <div className="mx-auto max-w-[1440px] space-y-5 px-5 py-8"><div className="admin-title"><div><p className="league-eyebrow">系統管理</p><h1>帳號與資料管理</h1></div><span>管理員</span></div><SectionBoundary><TurnstileSettings/></SectionBoundary><Accounts/><SectionBoundary><CpblMarketStatus/></SectionBoundary><SectionBoundary><InternationalMarketStatus league="NPB"/></SectionBoundary><SectionBoundary><InternationalMarketStatus league="KBO"/></SectionBoundary><SectionBoundary><InternationalValidation/></SectionBoundary><SectionBoundary><PregameImports/></SectionBoundary><SectionBoundary><TwtoolsReference/></SectionBoundary><SectionBoundary><InternationalData/></SectionBoundary><SectionBoundary><ResearchPanel/></SectionBoundary><AdminTools/></div>
  </main>;
}
