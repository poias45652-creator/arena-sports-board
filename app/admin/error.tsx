'use client';
import { leaguePageHref } from '@/lib/sport-navigation';
export default function AdminError({reset}:{reset:()=>void}){return <main className="min-h-screen bg-[#081522] text-slate-100 p-8"><h1 className="text-2xl font-bold">管理後台暫時無法載入</h1><p className="my-4">請重試，或重新登入管理員帳號。</p><div className="flex gap-4"><button className="header-action" onClick={reset}>重試</button><a href="/login" className="header-action">重新登入</a><a href={leaguePageHref('MLB')} className="header-action">返回賽事</a></div></main>;}
