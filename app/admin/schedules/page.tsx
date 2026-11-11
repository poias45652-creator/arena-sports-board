import Link from 'next/link';
import {redirect} from 'next/navigation';
import {adminIdentity} from '../../admin-access';
import {projectScheduleReport,scheduleProjectUrl} from '@/lib/project-schedules';
import {baseballBackgroundStatus} from '@/server/baseball-background-state.mjs';

export const dynamic='force-dynamic';
function time(timestamp:string|null){
 if(!timestamp)return '尚無紀錄';
 const value=Date.parse(timestamp);
 return Number.isFinite(value)?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(value):'時間無法確認';
}
const outcome={completed:'完成',partial:'部分完成',blocked:'受阻'};
const actionState:Record<string,string>={success:'成功',failure:'失敗',in_progress:'執行中',queued:'等候執行',cancelled:'已取消',timed_out:'逾時',skipped:'已略過',action_required:'待處理',startup_failure:'無法啟動',neutral:'無判定',waiting:'等待中',requested:'已提出'};
export default async function ProjectSchedules(){
 if(!await adminIdentity())redirect('/login');
 const {tasks,workflows,synced}=await projectScheduleReport();
 const background=baseballBackgroundStatus();
 return <main className="arena-shell min-h-screen px-5 py-8 text-slate-100"><div className="mx-auto max-w-6xl space-y-6">
  <nav className="flex flex-wrap gap-3"><Link prefetch={false} className="header-action" href="/admin/system">返回系統管理</Link><a className="header-action" href={scheduleProjectUrl} target="_blank" rel="noreferrer">開啟排程專案與完整報告</a></nav>
  <header><h1 className="text-2xl font-bold">星準排程管理</h1><p className="mt-2 text-slate-300">專案登記 {tasks.length} 項。時間以台灣時間顯示，個別排程另列時區。</p></header>
  <section className="panel p-5"><h2 className="text-lg font-bold">專案任務</h2>
   <p className="my-2 text-sm text-slate-300">{synced?'設定核對時間':'設定來源暫時無法讀取，顯示部署時的登記資料'}　{time(tasks.map(t=>t.asOf).sort()[0])}</p>
   <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['任務與時程','登記狀態','最近執行','最近結果'].map(x=><th key={x} scope="col" className="p-2">{x}</th>)}</tr></thead>
   <tbody>{tasks.map(t=><tr key={t.key} className="border-t border-white/10"><th scope="row" className="p-2"><strong>{t.name}</strong><details className="mt-1 font-normal text-slate-300"><summary>{t.timing}</summary><div>{t.timezone}</div><pre className="whitespace-pre-wrap">{t.schedule}</pre></details></th>
   <td className="p-2">{!t.enabled?'暫停':!t.schedule.includes('RRULE:')&&t.receipt?.reportedAt?'單次已回報':!t.schedule.includes('RRULE:')?'單次排定':'啟用'}</td><td className="p-2">{time(t.lastRunAt)}</td>
   <td className="p-2">{!t.receipt?'回執暫時無法讀取':t.receipt.outcome?<>{outcome[t.receipt.outcome]} · {time(t.receipt.reportedAt)}{t.receipt.checked!==null&&<div>核對 {t.receipt.checked} 項</div>}{t.receipt.issues!==null&&<div>發現 {t.receipt.issues} 項問題</div>}</>:'尚無結果回執'}</td></tr>)}</tbody></table></div></section>
  <section className="panel p-5"><h2 className="text-lg font-bold">網站定時資料更新</h2><ul className="mt-3 space-y-3">{workflows.map(w=><li key={w.file}><a className="underline" href={w.url} target="_blank" rel="noreferrer">{w.name}</a>　{w.timing}<div className="text-sm text-slate-300">{!w.observed?'工作流紀錄暫時無法讀取':w.started?'最近定時執行 '+time(w.started)+' · '+(actionState[w.state]??'狀態待確認'):'尚無定時執行紀錄'}</div></li>)}</ul></section>
  <section className="panel p-5"><h2 className="text-lg font-bold">伺服器背景更新</h2><p className="mt-2">台日韓職棒場況更新　{background.enabled?'運作中':'目前未啟用'}</p><a className="text-sm underline" href="/admin/system">查看各聯盟更新紀錄</a><p className="mt-3">Super007 盤口採集　Cloudflare 設定為每分鐘執行。</p><a className="text-sm underline" href="/api/operations" target="_blank" rel="noreferrer">查看採集時間與成功、失敗次數</a></section>
 </div></main>;
}
