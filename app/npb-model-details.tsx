import {buildNpbAnalysis,NPB_MODEL_VERSION} from '@/lib/npb-analysis';
import type {PregameGame} from '@/lib/international-pregame';

export default function NpbModelDetails({game}:{game:PregameGame}){
 if(game.league!=='NPB')return null;
 const report=buildNpbAnalysis(game);
 return <details className="rounded-lg border border-slate-600 bg-slate-900/50">
  <summary className="cursor-pointer p-4 font-bold">日職分析計算 · {report.status==='ready'?'已產生估算':report.reason}</summary>
  <div className="space-y-3 px-4 pb-4 text-sm text-slate-300">
   <p>版本 {NPB_MODEL_VERSION}。確定性統計基準模型；未經歷史回測、訓練或勝率校準。資料涵蓋率不代表預測準確率。</p>
   <p>每局得分率＝（己方得分能力 × 50% ＋ 對方團隊失分 × 25% ＋ 對方投手失分估值 × 25%）÷ 9。權重為初始假設，未由歷史比賽擬合。</p>
   <p>攻守主客場分項至少 10 場，本季至少 20 場；分項加上 20 場本季均值收縮。先發 ERA 加入 20 局、牛棚 ERA 加入 60 局團隊失分均值收縮。ERA 為責失分，與總失分的差異尚未另外建模。</p>
   <p>先發局數採近 60 日最多 5 場登板平均，至少 3 場、範圍 3–7 局；不足時使用 5 局假設。WHIP、待核對的打擊表、傷停、天氣、球場因子及牛棚近期用量未納入。</p>
   <p>各局採獨立 Poisson 得分分布；上半計前 5 局。全場模型依 9 局及最多 3 局延長的設定計算，12 局後保留和局，主隊領先時不打九下。再見得分簡化為領先 1 分，未模擬再見全壘打多得分、雨裁及特殊賽制。</p>
   <p>獨贏平手列走盤；讓分與大小依終場分數和來源讓分、中洞比例結算。四項機率另加走盤合計 100%。模型優選以預期淨值＝加權贏額機率 × 不含本金賠率 − 加權輸額機率大於 0 為條件；不是保證獲利。</p>
   <p>只配對同日、同時間、同主客隊、同先發的賽前資料；擷取時間需早於開賽且不超過 36 小時。報價超過 150 秒、已封盤、先發改變、開賽或資料待核對時停止對應估算／優選。既有快照不會套用到隔日。</p>
   {!!Object.keys(report.inputs).length&&<div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{['球隊','攻擊均值','團隊失分','先發 ERA（收縮）','牛棚 ERA（收縮）','先發估計局數'].map(h=><th className="whitespace-nowrap border-b border-slate-600 p-2" key={h}>{h}</th>)}</tr></thead><tbody>{Object.values(report.inputs).map(r=><tr key={r.team}>{[r.team,r.offense.toFixed(3),r.defense.toFixed(3),r.starterEra.toFixed(3),r.bullpenEra.toFixed(3),r.starterInnings.toFixed(2)].map((v,i)=><td className="border-b border-slate-700 p-2" key={i}>{v}</td>)}</tr>)}</tbody></table></div>}
   {report.win&&report.expected&&<p>九局得分期望：客 {report.expected.away.toFixed(2)}／主 {report.expected.home.toFixed(2)}。全場估算：客勝 {(report.win.away*100).toFixed(2)}%、主勝 {(report.win.home*100).toFixed(2)}%、和局 {(report.win.draw*100).toFixed(2)}%。</p>}
   {report.notes.map(note=><p key={note} className="text-amber-200">{note}</p>)}
  </div>
 </details>;
}
