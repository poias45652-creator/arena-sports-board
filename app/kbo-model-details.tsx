import {buildRunAnalysis,MODEL_VERSION} from '@/lib/baseball-run-analysis';
import type {PregameGame} from '@/lib/international-pregame';

export default function KboModelDetails({game}:{game:PregameGame}){
 if(game.league!=='KBO')return null;
 const report=buildRunAnalysis(game,Date.now(),'KBO');
 return <details className="rounded-lg border border-slate-600 bg-slate-900/50">
  <summary className="cursor-pointer p-4 font-bold">韓職分析計算 · {report.status==='ready'?'已產生估算':report.reason}</summary>
  <div className="space-y-3 px-4 pb-4 text-sm text-slate-300">
   <p>版本 {MODEL_VERSION.KBO}。本站自行計算客勝、主勝、和局、九局得分期望及七種玩法機率。使用統計基準模型，尚未經韓職歷史回測與校準。</p>
   <p>球隊得失分由本場日期以前的例行賽完賽紀錄加總，再除以實際出賽場數；和局也計入場數。同場紀錄去重，未完賽、當日和未來比賽不納入。</p>
   {game.comparisonSource&&<p>團隊資料：<a className="underline" href={game.comparisonSource.url} target="_blank" rel="noreferrer">{game.comparisonSource.name}</a>，共 {game.comparisonSource.games} 場，賽果截至 {game.comparisonSource.throughDate}；擷取 {new Date(game.comparisonSource.observedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}（台灣）。</p>}
   <p>每局得分率＝（己方得分能力 × 50% ＋ 對方團隊失分 × 25% ＋ 對方投手失分估值 × 25%）÷ 9。本季至少 20 場；主客場分項至少 10 場，加入 20 場本季均值收縮。先發 ERA 加入 20 局、牛棚 ERA 加入 60 局團隊失分均值收縮；權重與收縮量均為初始設定。</p>
   <p>先發預計投球局數採近 60 日最多 5 場登板平均，至少 3 場、限制 3–7 局；不足時估 5 局。牛棚 ERA 與局數為必要欄位，不以排行榜或空值代填。ERA 與總失分差異、WHIP、傷停、確認打線、天氣、球場及近期牛棚用量未另建模。</p>
   <p>各局採獨立 Poisson 分布；上半為前 5 局。一般例行賽最多 11 局，保留和局，未採突破僵局跑者。主隊領先不打九下；再見得分簡化為領先 1 分，未涵蓋再見全壘打多得分、雨裁。雙重賽與季後賽暫停估算。<a className="ml-1 underline" href="https://www.koreabaseball.com/Kbo/League/GameManage2025.aspx" target="_blank" rel="noreferrer">KBO 延長賽規則</a> · <a className="underline" href="https://www.koreabaseball.com/Kbo/League/GameManage2026.aspx" target="_blank" rel="noreferrer">2026 規則變更</a></p>
   <p>獨贏和局退回；讓分、大小、中洞比例按來源報價結算。全贏、中洞贏、中洞輸、全輸，加走盤共 100%。推薦以加權贏額機率 × 不含本金賠率 − 加權輸額機率大於 0，每場最多一項。</p>
   <p>統計與場次核對時間須早於開賽且不超過 36 小時。同日、同時間、同主客隊及同先發才配對；成績待核對、先發更換、資料過期或開賽後停止賽前估算。報價超過 150 秒、缺盤或封盤時停止該玩法機率與推薦。</p>
   {!!Object.keys(report.inputs).length&&<div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{['球隊','樣本場次','攻擊均值','團隊失分','先發 ERA（收縮）','牛棚 ERA（收縮）','先發估計局數'].map(h=><th className="whitespace-nowrap border-b border-slate-600 p-2" key={h}>{h}</th>)}</tr></thead><tbody>{Object.values(report.inputs).map(r=><tr key={r.team}>{[r.team,r.games,r.offense.toFixed(3),r.defense.toFixed(3),r.starterEra.toFixed(3),r.bullpenEra.toFixed(3),r.starterInnings.toFixed(2)].map((v,i)=><td className="border-b border-slate-700 p-2" key={i}>{v}</td>)}</tr>)}</tbody></table></div>}
   {report.win&&report.expected&&<p>九局得分期望：客 {report.expected.away.toFixed(2)}／主 {report.expected.home.toFixed(2)}。全場估算：客勝 {(report.win.away*100).toFixed(2)}%、主勝 {(report.win.home*100).toFixed(2)}%、和局 {(report.win.draw*100).toFixed(2)}%。</p>}
   {report.notes.map(note=><p key={note} className="text-amber-200">{note}</p>)}
  </div>
 </details>;
}
