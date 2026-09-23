"use client";
import {useEffect,useState} from 'react';
import {pregameImports as initialImports} from '@/lib/pregame-imports';
import {summarizePregameImport} from '@/lib/international-pregame';
import type {PregameData} from '@/lib/international-pregame';
import InternationalPregameDetails from '../international-pregame-details';
import CpblGameLogs from './cpbl-game-logs';
const stamp=(at?:string)=>at&&Number.isFinite(Date.parse(at))?new Date(at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'尚未取得';
export default function PregameImports(){
 const [date,setDate]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date()));
 const [feeds,setFeeds]=useState<Record<string,any>>({});
 useEffect(()=>{setFeeds({});let active=true,busy=false;const c=new AbortController();async function load(){if(busy||document.hidden)return;busy=true;try{await Promise.all(['CPBL','NPB','KBO'].map(async league=>{try{const r=await fetch(`/api/international?kind=${league.toLowerCase()}-pregame&date=${encodeURIComponent(date)}`,{cache:'no-store',signal:AbortSignal.any([c.signal,AbortSignal.timeout(45000)])});if(!r.ok)throw Error();const data=await r.json();if(active)setFeeds(old=>({...old,[league]:data}));}catch{if(active)setFeeds(old=>({...old,[league]:{...old[league],status:'stale',error:'更新暫時失敗，稍後自動重試'}}));}}));}finally{busy=false;}}void load();const timer=setInterval(()=>void load(),300000),resume=()=>{if(!document.hidden)void load();};window.addEventListener('arena-refresh-all',resume);document.addEventListener('visibilitychange',resume);return()=>{active=false;c.abort();clearInterval(timer);window.removeEventListener('arena-refresh-all',resume);document.removeEventListener('visibilitychange',resume);}},[date]);
 const pregameImports:PregameData[]=initialImports.map(original=>feeds[original.league]?.pregame||(original.date===date?original:{...original,date,observedAt:'',games:[]}));
 return <section className="panel admin-section" aria-label="賽前資料匯入與缺漏">
  <details><summary className="cursor-pointer p-5 text-lg font-bold">賽前資料、自動更新與缺漏 · {pregameImports.reduce((n,d)=>n+d.games.length,0)} 場</summary>
   <div className="space-y-5 px-4 pb-5"><label className="flex items-center gap-3 text-sm">檢查賽事日期<input type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value)}} className="rounded border border-slate-600 bg-slate-900 p-2"/></label>
    <p className="text-sm text-slate-300">網頁顯示的盤口及場中比分約每 60 秒更新，賽前資料每 5 分鐘檢查。中職使用非官網來源；日職使用 Sportsnavi，韓職使用 Naver，另依所選日期更新玩運彩賽前統計。日職與韓職另有官方投手成績備援；只補入通過球季、球隊與欄位核對的資料，不以全隊投手總計冒充牛棚。更新失敗保留最後成功紀錄，歷史欄位保留原始時間。</p>
    <p className="text-sm text-amber-200">背景採集狀態請看上方「三聯盟背景更新」。伺服器運行期間不需停留在各聯盟頁面；免費主機休眠時仍會停止。</p>
    <div className="grid gap-3 md:grid-cols-3">{['CPBL','NPB','KBO'].map(league=>{const d=feeds[league];return <div key={league} className="rounded-lg border border-slate-600 p-3 text-sm"><h3 className="font-bold">{league} · {d?d.status==='ready'?'本次資料已更新':d.status==='partial'?'部分資料已取得，仍有缺漏':d.status==='stale'?'保留上次資料':'資料待補':'正在檢查'}</h3><p className="mt-2 text-slate-300">檢查時間：{stamp(d?.checkedAt)}</p>{d?.live&&<p className="mt-2">賽事 {d.live.games} 場 · 先發 {d.live.starters} 位 · 完整打序 {d.live.lineups} 隊</p>}{d?.coverage&&<p>賽前 ERA {d.coverage.era}/{d.coverage.teams} · WHIP {d.coverage.whip}/{d.coverage.teams}</p>}{(d?.error||d?.storageError)&&<p className="mt-2 text-amber-200">{d.error||d.storageError}</p>}{!!d?.playsport?.errors?.length&&<p className="mt-2 text-amber-200">賽前統計：{[...new Set<string>(d.playsport.errors)].join('；')}</p>}{d?.analysisCoverage&&<div className="mt-2"><p>可運算分析：{d.analysisCoverage.ready}/{d.analysisCoverage.total} 場</p>{d.analysisCoverage.blocked.map((g:any)=><p key={[g.start,g.away,g.home].join("|")} className="mt-1 text-xs text-amber-200">{g.start} · {g.away} vs {g.home}：{g.reason}</p>)}</div>}{d?.statsFallback&&<div className="mt-2"><p>官方投手備援：{d.statsFallback.rows} 筆通過核對（未必是本場先發）</p>{!!d.statsFallback.errors?.length&&<p className="text-amber-200">{[...new Set<string>(d.statsFallback.errors)].join('；')}</p>}{!!d.statsFallback.sources?.length&&<details className="mt-1"><summary className="cursor-pointer">備援來源明細</summary>{d.statsFallback.sources.map((s:any)=><p key={s.url} className="mt-1 break-all text-xs text-slate-300">{s.url} · {s.rows} 筆 · {stamp(s.observedAt)}{s.error?' · '+s.error:''}</p>)}</details>}</div>}{!!d?.pregame?.excludedFixtures?.length&&<p className="mt-2 text-slate-300">取消／延賽：{d.pregame.excludedFixtures.map((x:any)=>`${x.away} vs ${x.home}`).join('、')}</p>}{d?.forecastStorage?.error&&<p className="mt-2 text-amber-200">{d.forecastStorage.error}</p>}</div>})}</div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="pb-3 text-left font-bold">本次資料涵蓋範圍</caption><thead><tr>{['聯盟','場次','先發姓名','可顯示先發成績','完整牛棚成績','團隊打擊','投手逐場紀錄'].map(h=><th key={h} className="whitespace-nowrap border-b border-slate-600 p-3 text-left">{h}</th>)}</tr></thead><tbody>{pregameImports.map(data=>{const s=summarizePregameImport(data);return <tr key={data.league}>{[s.league,s.games,`${s.pitchers}/${s.teams}`,`${s.usablePitchers}/${s.teams}`,`${s.completeBullpens}/${s.teams}`,`${s.batting}/${s.teams}`,s.appearances].map((v,i)=><td key={i} className="border-b border-slate-700 p-3">{v}</td>)}</tr>})}</tbody></table></div>
    <div className="rounded-lg border border-amber-300/30 bg-amber-300/5 p-4 text-sm"><h3 className="mb-3 font-bold text-amber-200">尚缺資料與功能</h3><ul className="list-disc space-y-2 pl-5">
     <li>三聯盟：團隊研究模型已完成首輪時間切分回測與校準，尚未通過上線門檻；結果見上方「三聯盟回測與機率校準」。完整模型已接入賽前預測留存。</li>
     <li>三聯盟：當日確認打線、傷停與臨時更換先發；日職與韓職仍缺近期牛棚用量。</li>
     <li>中職：已接 Yahoo 非官網逐場日誌，自行彙算團隊得失分、先發與後援成績；投手表涵蓋率見下方。仍缺完整投球數與未取得的先發，新聞先發只適用指定日期。</li>
     <li>逐球資料：只顯示來源實際提供的球數、出局與壘包；目前尚未驗證傳輸延遲。</li>
     <li>背景更新：服務休眠或重啟會中斷，全天候不中斷的執行環境仍待配置。</li>
     <li>日職：已接上勝率、九局得分與七種玩法的統計估算；資料更新時重新計算，仍待歷史回測與機率校準。各場公式與使用欄位見下方日職分析計算。</li>
     <li>中職：已改為逐場日誌推算，牛棚優先採後援實際局數與責失；完整日誌不足才使用團隊失分均值。每 5 分鐘檢查，單次最多更新 6 場投手表並保存；仍待歷史回測與校準。</li>
     <li>韓職：已接上本站運算的勝率、和局、九局得分與七種玩法機率。團隊得失分由賽前完賽紀錄彙算，更新後重新計算；先發成績有衝突的場次暫不估算。雙重賽、季後賽規則及歷史回測校準待完成。</li>
     <li>韓職先發核對：9/20 樂天 김태균、斗山朴信止的局數及四壞／觸身球差異已逐場核對，修正記錄見各場「資料衝突已核對」。核對時間保留，不補造已開賽場次的賽前預測。</li>
    </ul></div>
    <CpblGameLogs data={feeds.CPBL?.gameLogs}/>
    {pregameImports.map(data=>{const s=summarizePregameImport(data);return <details key={data.league} className="rounded-lg border border-slate-600"><summary className="cursor-pointer p-4 font-bold">{data.league} · {data.date} · {s.games} 場資料明細</summary><div className="space-y-3 px-4 pb-4">
     <p className="text-sm text-slate-300">擷取 {stamp(data.observedAt)}（台灣）</p>
     {s.pitchers<s.teams&&<p className="text-sm text-amber-200">缺少 {s.teams-s.pitchers} 位先發姓名及投手成績。</p>}
     {s.completeBullpens<s.teams&&<p className="text-sm text-amber-200">缺少 {s.teams-s.completeBullpens} 隊本季完整牛棚成績（含局數、ERA、WHIP、三振、四壞）；中職近期推算範圍另見逐場日誌。</p>}
     {!!s.reviewPitchers.length&&<p className="text-sm text-amber-200">投手成績待核對：{s.reviewPitchers.join('、')}。</p>}
     {!!s.reviewBatting.length&&<p className="text-sm text-amber-200">{s.reviewBatting.length} 隊團隊打擊累計與主客場分項不一致；已保留來源數值並加註。</p>}
     {data.games.map(game=><details key={game.id} className="rounded-lg border border-slate-700"><summary className="cursor-pointer p-3 text-sm font-bold">{game.start} · {game.away.team}（客）vs {game.home.team}（主）</summary><InternationalPregameDetails game={game}/></details>)}
    </div></details>})}
   </div>
  </details>
 </section>;
}
