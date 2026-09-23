import type {PregameGame} from '@/lib/international-pregame';
import type {SourceTable} from '@/lib/international';
import NpbModelDetails from './npb-model-details';
import CpblModelDetails from './cpbl-model-details';
import KboModelDetails from './kbo-model-details';

function DataTable({table}:{table:SourceTable}){
 return <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="pb-2 text-left font-bold">{table.title}</caption><thead><tr>{table.headers.map((h,i)=><th key={i} scope="col" className="whitespace-nowrap border-b border-slate-600 px-3 py-2 text-left text-slate-300">{h}</th>)}</tr></thead><tbody>{table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j} className="whitespace-nowrap border-b border-slate-700/60 px-3 py-2">{cell||'—'}</td>)}</tr>)}</tbody></table></div>;
}
export default function InternationalPregameDetails({game}:{game:PregameGame}){
 const captured=new Date(game.source.observedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
 return <div className="space-y-4 p-4">
  <NpbModelDetails game={game}/><CpblModelDetails game={game}/><KboModelDetails game={game}/>
  <p className="text-sm text-slate-300">{game.date} 賽前資料 · <a className="underline underline-offset-4" href={game.source.url} target="_blank" rel="noreferrer">{game.source.name}</a> · 擷取 {captured}（台灣）。先發以來源後續更新為準。</p>
  <div className="grid min-w-0 gap-4 lg:grid-cols-2">{(['away','home'] as const).map(side=>{
   const team=game[side],pitcher=team.starter,valid=pitcher.quality==='source_reported';
   const stats=valid?pitcher.season:null;
   return <section key={side} className="min-w-0 space-y-4 rounded-lg border border-slate-600 p-4">
    <h3 className="text-base font-bold">{team.team}（{side==='away'?'客':'主'}）· {pitcher.name||'先發尚未公布'}</h3>
    {pitcher.source&&<p className="text-xs text-slate-400">先發補充來源：<a className="underline" href={pitcher.source.url} target="_blank" rel="noreferrer">{pitcher.source.name}</a> · 核對 {new Date(pitcher.source.observedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}（台灣）</p>}
    {pitcher.statSources&&<details className="text-sm text-slate-300"><summary className="cursor-pointer">投手成績來源與原始時間</summary><p className="my-2">既存檔案補入的欄位保留原始時間；本次未重新抓取中職官網，也不代表逐球更新。</p><DataTable table={{title:'投手欄位來源',headers:['欄位','數值','來源','原始擷取時間（台灣）'],rows:Object.entries(pitcher.statSources).map(([field,s])=>[({wins:'勝',losses:'敗',era:'ERA',innings:'局數',strikeouts:'三振',walks:'四壞',whip:'WHIP'} as Record<string,string>)[field]||field,pitcher.season[field as keyof typeof pitcher.season],s!.name,new Date(s!.observedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})])}}/></details>}
    {team.retainedSource&&<p className="text-xs text-slate-400">牛棚、打擊及未重新提供的投手欄位保留 {team.retainedSource.name} 原紀錄（{new Date(team.retainedSource.observedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}）；不代表本次已重新取得。</p>}
    {!!team.lineup?.length&&<DataTable table={{title:'來源先發打序',headers:['棒次','球員','守位'],rows:team.lineup.map(p=>[String(p.order??''),p.name,p.position||''])}}/>}
    {team.pitchingSource&&<p className="text-xs text-slate-400">投手與牛棚資料另由上傳的<a className="underline" href={team.pitchingSource.url} target="_blank" rel="noreferrer">玩運彩對戰頁</a>補入。檔案接收：{new Date(team.pitchingSource.receivedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}（台灣）；原始擷取時間未提供，非自動更新。</p>}
    {pitcher.review&&<details className="rounded-md border border-emerald-400/30 p-3 text-sm"><summary className="cursor-pointer font-bold">資料衝突已核對</summary><p className="my-2">{pitcher.review.note}</p><p>核對時間：{new Date(pitcher.review.reviewedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}（不回填為原始擷取時間）</p>{pitcher.review.sources.map(s=><p key={s.url}><a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.name}</a></p>)}</details>}
    {pitcher.warnings.map(w=><p key={w} className="text-sm text-amber-200">{w}</p>)}
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[['本季投球局數',stats?.innings],['三振',stats?.strikeouts],['四壞',stats?.walks],['被打擊率',stats?.opponentAverage]].map(([label,value])=><div key={label}><dt className="text-slate-400">{label}</dt><dd className="mt-1 text-base font-bold">{value||'—'}</dd></div>)}</dl>
    <div className="rounded-md bg-slate-800/70 p-3 text-sm"><h4 className="mb-2 font-bold">球隊牛棚 · {team.bullpenSource?.scope==='recent'?`最近 ${team.bullpenSource.games} 場`:'本季累計'}</h4>{team.bullpen?<><p>ERA <strong>{team.bullpen.era}</strong>　WHIP <strong>{team.bullpen.whip||'—'}</strong>　局數 {team.bullpen.innings}</p><p className="mt-1 text-slate-300">三振 {team.bullpen.strikeouts} · 四壞 {team.bullpen.walks||'—'}</p></>:<p>本次來源未提供</p>}</div>
    {team.bullpenSource&&<p className="text-xs text-slate-400"><a className="underline" href={team.bullpenSource.url} target="_blank" rel="noreferrer">{team.bullpenSource.name}</a> · 截至 {team.bullpenSource.throughDate} · {team.bullpenSource.note}</p>}
    {team.battingWarnings?.map(w=><p key={w} className="text-sm text-amber-200">{w}</p>)}
    <DataTable table={team.batting}/>
    {!!pitcher.splits.rows.length&&<details><summary className="cursor-pointer text-sm font-bold">投手分項成績{valid?'':'（來源數值待核對）'}</summary><div className="mt-3"><DataTable table={pitcher.splits}/></div></details>}
    {!!pitcher.recent.rows.length&&<details><summary className="cursor-pointer text-sm font-bold">逐場出賽紀錄 · {pitcher.recent.rows.length} 筆</summary><div className="mt-3"><DataTable table={pitcher.recent}/></div></details>}
   </section>;
  })}</div>
  {game.comparison&&<details><summary className="cursor-pointer text-sm font-bold">球隊戰績與得失分</summary><div className="mt-3"><DataTable table={game.comparison}/></div></details>}
 </div>;
}
