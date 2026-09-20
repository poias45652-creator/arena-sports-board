import data from '@/data/twtools-reference-20260920.json';

type TableData={title:string;headers:string[];rows:string[][]};
function DataTable({table}:{table:TableData}){
 return <div className="overflow-x-auto rounded-lg border border-slate-700">
  <table className="w-full text-sm"><caption className="p-3 text-left font-bold">{table.title}</caption>
   <thead><tr>{table.headers.map((h,i)=><th key={i} className="whitespace-nowrap border-b border-slate-600 px-3 py-2 text-left text-slate-300">{h}</th>)}</tr></thead>
   <tbody>{table.rows.map((r,i)=><tr key={i}>{r.map((cell,j)=><td key={j} className="whitespace-nowrap border-b border-slate-700/50 px-3 py-2 tabular-nums">{cell}</td>)}</tr>)}</tbody>
  </table>
 </div>;
}

export default function TwtoolsReference(){
 const teamCount=data.leagues.reduce((n,l)=>n+l.teamCount,0);
 const leaderCount=data.leagues.reduce((n,l)=>n+l.leaderboardRowCount,0);
 const duplicates=data.gameAudit.filter(g=>g.status==='already_present').length;
 return <section className="panel admin-section" aria-label="四聯盟補充資料">
  <details><summary className="cursor-pointer p-5 text-lg font-bold">四聯盟補充資料 · {teamCount} 隊 · {leaderCount} 筆榜單</summary>
   <div className="space-y-5 px-4 pb-5 text-sm">
    <p><a href={data.source} target="_blank" rel="noreferrer" className="underline">棒球數據誌 · 非官方整理資料</a> · 核對匯入 {new Date(data.observedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}（台灣）</p>
    <p className="text-slate-300">已保存為後台日期快照。各聯盟日期與統計範圍不同；未覆蓋較新的成績，也未將舊榜單或不完整比分送入機率計算。</p>
    <div className="overflow-x-auto"><table className="w-full"><thead><tr>{['聯盟','來源截止日','已保存','用途'].map(h=><th key={h} className="whitespace-nowrap border-b border-slate-600 p-3 text-left">{h}</th>)}</tr></thead>
     <tbody>{data.leagues.map(l=><tr key={l.league}><td className="p-3 font-bold">{l.league}</td><td className="whitespace-nowrap p-3 tabular-nums">{l.sourceAsOf}</td><td className="p-3">{l.teamCount} 隊戰績{l.leaderboardRowCount>0?`、${l.leaderboards.length} 項榜單（${l.leaderboardRowCount} 筆）`:''}</td><td className="p-3">日期參考</td></tr>)}</tbody>
    </table></div>
    {data.leagues.map(l=><details key={l.league} className="rounded-lg border border-slate-700 p-4">
     <summary className="cursor-pointer font-bold">{l.league} · {l.scope}</summary>
     <div className="mt-4 space-y-4"><p className="text-slate-300">資料截至 {l.sourceAsOf} · <a href={l.sourceUrl} target="_blank" rel="noreferrer" className="underline">查看來源</a></p>
      <ul className="list-disc space-y-1 pl-5 text-slate-300">{l.notes.map(n=><li key={n}>{n}</li>)}</ul>
      <div className="grid gap-4 xl:grid-cols-2">{l.standings.map(t=><DataTable key={t.title} table={t}/>)}</div>
      {l.leaderboards.length>0&&<details><summary className="cursor-pointer font-bold">個人成績榜 · {l.leaderboardRowCount} 筆</summary><div className="mt-4 grid gap-4 xl:grid-cols-2">{l.leaderboards.map(t=><DataTable key={t.title} table={t}/>)}</div></details>}
     </div>
    </details>)}
    <details className="rounded-lg border border-slate-700 p-4"><summary className="cursor-pointer font-bold">歷史比分核對 · {duplicates} 場已存在，略過重複匯入</summary>
     <div className="mt-4"><DataTable table={{title:'中職、日職、韓職比分核對',headers:['聯盟','日期','來源列示對戰','比分','核對結果'],rows:data.gameAudit.map(g=>[g.league,g.date,`${g.firstTeam} / ${g.secondTeam}`,`${g.firstScore}：${g.secondScore}`,g.status==='already_present'?'已存在且比分一致':'待核對'])}}/></div>
    </details>
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4"><p className="font-bold">這個來源仍無法補齊</p><p className="mt-2 text-slate-300">完整牛棚分項與近三日用球、今日先發異動、即時盘口／賠率、逐球更新。救援和中繼榜單不等於完整牛棚資料。</p><p className="mt-2 text-slate-300">本次為資料匯入，尚未啟用此來源的自動擷取；中職來源本身是人工快照。全天背景排程仍待啟用，不能視為已經全天自動更新。</p></div>
   </div>
  </details>
 </section>;
}
