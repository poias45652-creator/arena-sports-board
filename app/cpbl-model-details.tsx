import {buildRunAnalysis,MODEL_VERSION,RUN_MODEL_WEIGHTS} from '@/lib/baseball-run-analysis';
import type {PregameGame} from '@/lib/international-pregame';

export default function CpblModelDetails({game}:{game:PregameGame}){
 if(game.league!=='CPBL')return null;
 const r=buildRunAnalysis(game,Date.now(),'CPBL');
 return <details className="rounded-lg border border-slate-600 bg-slate-900/50">
  <summary className="cursor-pointer p-4 font-bold">中職分析計算 · {r.status==='ready'?'已產生基準估算':r.reason}</summary>
  <div className="space-y-3 px-4 pb-4 text-sm text-slate-300">
   <p>版本 {MODEL_VERSION.CPBL}。以非官網逐場比賽日誌（Game Logs）推算九局得分、全場勝／和機率與七種玩法。這是未回測、未校準的統計基準模型，資料涵蓋率不是預測準確率。</p>
   <p>球隊得失分由本場日期之前的例行賽完賽紀錄加總，含和局；同場去重，當日、未完賽、熱身賽不納入。先發球季成績須該隊全部完賽投手明細齊全才重算；不足時保留原先已核對的成績；原先成績也不可用時，以最近 10 或 5 場連續完整賽程中的投手紀錄作收縮估計，不標示成本季成績。</p>
   <p>前九局每局得分率＝（對方先發 ERA × {RUN_MODEL_WEIGHTS.starter*100}% ＋ 己方得分能力 × {RUN_MODEL_WEIGHTS.offense*100}% ＋ 對方團隊失分 × {RUN_MODEL_WEIGHTS.defense*100}% ＋ 對方牛棚 ERA × {RUN_MODEL_WEIGHTS.bullpen*100}%）÷ 9。權重是初始假設。本季至少 20 場；主客場分項至少 10 場，加上 20 場本季均值收縮。</p>
   <p>先發占九局得分估值的 60%，是收縮後統計的輸入權重，不是直接增加 60 個勝率百分點；再由比分分布計算勝／和機率。前九局採相同平均得分率，不按先發局數再折減權重，也不代表先發投滿九局。延長賽不再計入先發，剩餘權重正規化為攻擊 50%、團隊失分 25%、牛棚 25%。</p>
   <p>ERA＝責失 × 27 ÷ 出局數，WHIP＝（安打＋四壞）× 3 ÷ 出局數；0.1／0.2 局按 1／2 個出局計算，不是小數局數。先發 ERA 加入 20 局團隊失分均值收縮；牛棚排除投手順序第 1 位，且與出賽名單核對，優先彙算全季，否則依序使用完整最近 10 場或 5 場，加入 60 局收縮。未齊時保留團隊失分估值，不把估值寫成牛棚實測成績。</p>
   <p>日誌的先發參考局數只採近 60 日最多 5 場先發登板（至少 3 場，限制 3–7 局），不足時列 5 局假設，僅供後台參考，不改變固定權重。每局採獨立 Poisson 分布，上半為前 5 局。主隊領先不打九下；再見得分簡化為領先 1 分，未包含再見全壘打多得分。近期後援局數已彙整，疲勞係數、打線、天氣、球場及傷停尚未建模。</p>
   <p>例行賽延長至最多 12 局，10 局起二壘突破僵局：額外跑者以獨立 Bernoulli 得分事件近似，得分機率暫設 60%，未經中職資料校準。12 局仍平手保留和局，不強行分配給兩隊。<a className="ml-1 underline" href="https://www.cna.com.tw/news/aspt/202401100238.aspx" target="_blank" rel="noreferrer">賽制來源</a></p>
   <p>獨贏和局退回；讓分、大小與中洞比例依來源盤口結算。四項機率加走盤合計 100%。推薦採加權贏額機率 × 賠率 − 加權輸額機率大於 0，每場最多一項。</p>
   <p>只使用同日、同時間、同主客隊及同先發的資料。各統計欄位需早於開賽、未來時間不採用且不超過 36 小時；已開賽、先發變更或資料未核對則停止。報價超過 150 秒或封盤時不顯示市場機率。核對結果不得倒填到歷史回測；已開賽的場次不補造賽前預測。</p>
   {(['away','home'] as const).map(side=>{const t=game[side],logs=t.gameLogs;if(!logs)return null;return <div className="rounded border border-slate-600 p-3" key={side}><p className="font-bold">{t.team} · 逐場計算</p><p>賽果 {logs.games} 場，投手明細 {logs.coveredGames} 場；截至 {logs.throughDate}。資料取得 {new Date(logs.observedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}。</p>{logs.starter&&<p>{logs.starter.name}：{logs.starter.games} 場／{Math.floor(logs.starter.outs/3)}.{logs.starter.outs%3} 局，ERA {logs.starter.era.toFixed(2)}、WHIP {logs.starter.whip.toFixed(2)}。</p>}{logs.recentStarter&&<p>近期先發樣本（球隊近 {logs.recentWindow} 場）：{logs.recentStarter.name} {logs.recentStarter.games} 次登板，ERA {logs.recentStarter.era.toFixed(2)}、WHIP {logs.recentStarter.whip.toFixed(2)}；非本季成績。</p>}{logs.bullpen&&<p>牛棚（{logs.bullpenScope==='season'?'本季':`最近 ${logs.recentWindow} 場`}）：{Math.floor(logs.bullpen.outs/3)}.{logs.bullpen.outs%3} 局／{logs.bullpen.earnedRuns} 責失，ERA {logs.bullpen.era.toFixed(2)}、WHIP {logs.bullpen.whip.toFixed(2)}。</p>}{logs.recentRelief.map((v,i)=><p key={i}>{v.date} 後援：{Math.floor(v.outs/3)}.{v.outs%3} 局、{v.appearances} 人次，投球數 {v.pitches??'未提供'}。</p>)}{logs.notes.map(n=><p className="text-amber-200" key={n}>{n}</p>)}<a className="underline" href={logs.sourceUrl} target="_blank" rel="noreferrer">逐場來源</a></div>;})}
   {!!Object.keys(r.inputs).length&&<div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{['球隊','攻擊均值','團隊失分','先發 ERA（收縮）','牛棚項估值','後援依據'].map(h=><th className="whitespace-nowrap border-b border-slate-600 p-2" key={h}>{h}</th>)}</tr></thead><tbody>{Object.values(r.inputs).map(i=><tr key={i.team}>{[i.team,i.offense.toFixed(3),i.defense.toFixed(3),i.starterEra.toFixed(3),i.bullpenEra.toFixed(3),i.bullpenMode==='game_logs'?'逐場後援紀錄＋收縮':i.bullpenMode==='reported'?'牛棚實測＋收縮':'團隊失分替代'].map((v,j)=><td key={j} className="border-b border-slate-700 p-2">{v}</td>)}</tr>)}</tbody></table></div>}
   {r.expected&&r.win&&<p>九局：客 {r.expected.away.toFixed(2)}／主 {r.expected.home.toFixed(2)}；全場：客勝 {(r.win.away*100).toFixed(2)}%、主勝 {(r.win.home*100).toFixed(2)}%、和局 {(r.win.draw*100).toFixed(2)}%。</p>}
   {r.notes.map(note=><p className="text-amber-200" key={note}>{note}</p>)}
  </div>
 </details>;
}
