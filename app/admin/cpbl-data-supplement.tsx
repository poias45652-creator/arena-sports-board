import data from '@/data/cpbl-daily-supplement-20260920.json';

export default function CpblDataSupplement(){
 return <section className="panel admin-section" aria-label="中職資料補充">
  <details><summary className="cursor-pointer p-5 text-lg font-bold">中職每日資料補充 · {data.teams.length} 隊 · {data.leaderboards.reduce((n,t)=>n+t.rows.length,0)} 筆榜單</summary>
   <div className="space-y-5 px-4 pb-5 text-sm">
    <p>{data.updatedDate} 每日快照 · 匯入 {new Date(data.observedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}（台灣）· <a className="underline" href="https://b-aseball.tw/cpbl/" target="_blank" rel="noreferrer">B-ASEBALL.TW</a></p>
    <p className="text-slate-300">此次另將網站既存投手成績補入比賽卡片：按球隊與姓名核對，只補空值。資料保留原日期，未重新抓取中職官網；投手欄位來源見「賽前資料、自動更新與缺漏」。</p>
    <ul className="list-disc space-y-1 pl-5 text-slate-300">{data.notes.map(n=><li key={n}>{n}</li>)}<li>此處為已匯入快照，尚未啟用 B-ASEBALL 自動抓取；一般比分仍使用原有更新來源。</li></ul>
    <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="pb-3 text-left font-bold">六隊球季資料</caption><thead><tr>{['球隊','勝－敗','主場','客場','連勝／敗','得分','失分'].map(h=><th key={h} className="whitespace-nowrap border-b border-slate-600 p-3 text-left">{h}</th>)}</tr></thead><tbody>{data.teams.map(t=><tr key={t.teamCode}>{[t.team,`${t.wins}－${t.losses}`,`${t.home.wins}－${t.home.losses}`,`${t.away.wins}－${t.away.losses}`,`${t.streak} 連${t.streakResult}`,t.runsScored,t.runsAllowed].map((v,i)=><td key={i} className="whitespace-nowrap border-b border-slate-700 p-3">{v}</td>)}</tr>)}</tbody></table></div>
    <details><summary className="cursor-pointer font-bold">已补入的歷史賽果 · {data.games.length} 場</summary>{data.games.map(g=><div key={g.id} className="mt-3 rounded-lg border border-slate-700 p-3"><p>{g.date} · 台鋼雄鷹 {g.awayScore}：{g.homeScore} 樂天桃猿 · <a className="underline" href={g.url} target="_blank" rel="noreferrer">原始賽後資料</a></p><p className="mt-2 text-slate-300">逐局：台鋼 {g.inningScores.away.join('、')}；樂天 {g.inningScores.home.join('、')}。已納入歷史賽果，供近況統計使用；不覆蓋較新的即時紀錄。</p></div>)}</details>
    <details><summary className="cursor-pointer font-bold">個人成績榜 · 僅來源列出的球員</summary><div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.leaderboards.map(t=><div key={t.stat} className="overflow-x-auto rounded-lg border border-slate-700 p-3"><table className="w-full"><caption className="pb-2 text-left font-bold">{t.stat}</caption><thead><tr>{['球員','球隊','數值'].map(h=><th key={h} className="py-2 text-left">{h}</th>)}</tr></thead><tbody>{t.rows.map(r=><tr key={`${r.team}:${r.name}`}><td className="whitespace-nowrap py-1">{r.name}</td><td className="whitespace-nowrap px-2">{r.team}</td><td className="tabular-nums">{r.value}</td></tr>)}</tbody></table></div>)}</div></details>
   </div>
  </details>
 </section>;
}
