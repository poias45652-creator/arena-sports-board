import type {cpblLogCoverage} from '@/lib/cpbl-game-logs';
export default function CpblGameLogs({data}:{data?:ReturnType<typeof cpblLogCoverage>&{error?:string|null}}){
 if(!data)return <p className="text-sm text-slate-300">正在更新中職逐場日誌…</p>;
 return <details className="rounded-lg border border-slate-600"><summary className="cursor-pointer p-4 font-bold">中職 Game Logs · {data.season} 年逐場推算</summary><div className="space-y-3 px-4 pb-4 text-sm">
  <p>只納入分析日期之前的完賽紀錄。ERA 與 WHIP 由局數、責失、安打、四壞加總重算；尚未回測校準。</p>
  <p>來源檢查：{data.checkedAt?new Date(data.checkedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'尚未取得'}。<a className="underline" href={data.sourceUrl} target="_blank" rel="noreferrer">Yahoo 中職逐場資料</a></p>
  {data.error&&<p className="text-amber-200">{data.error}</p>}
  <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{['球隊','完賽／投手表','牛棚範圍','後援局數','ERA','WHIP'].map(h=><th key={h} className="whitespace-nowrap border-b border-slate-600 p-2">{h}</th>)}</tr></thead><tbody>{data.teams.map(({team,metrics:m})=><tr key={team}>{[team,m?`${m.games}／${m.coveredGames}`:'資料過期或待補',m?.bullpenScope==='season'?'本季':m?.bullpenScope==='last10'?'最近 10 場':m?.bullpenScope==='last5'?'最近 5 場':'不足',m?.bullpen?`${Math.floor(m.bullpen.outs/3)}.${m.bullpen.outs%3}`:'—',m?.bullpen?.era.toFixed(2)||'—',m?.bullpen?.whip.toFixed(2)||'—'].map((v,i)=><td className="border-b border-slate-700 p-2" key={i}>{v}</td>)}</tr>)}</tbody></table></div>
  <p>缺完整投手表的場次不以 0 補值；先發未公布或身份無法核對時停止該場估算。投球數未提供時，只統計後援局數及登板人次，尚未套用疲勞係數。</p>
  {!!data.errors.length&&<details><summary className="cursor-pointer text-amber-200">待補／未通過核對 {data.errors.length} 項</summary>{data.errors.map((error,i)=><p key={i}>{error}</p>)}</details>}
 </div></details>;
}
