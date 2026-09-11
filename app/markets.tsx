"use client";
import {useMemo,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {fresh,isPregame,type Match} from '@/lib/baseball';
import {expectedRuns,scoreGrid,settle,marketSuggestions,validLine,type MarketPick,type RunSnapshot} from '@/lib/markets';
import {matchOdds,type OddsSnapshot} from '@/lib/pinnacle';
import type {AnalysisState} from './game-context';
import {teamZh} from './zh';
const pct=(p:number)=>(p*100).toFixed(1)+'%';
const signed=(n:number)=>(n>0?'+':'')+n;
const same=(a:MarketPick,b:MarketPick)=>a.gameId===b.gameId&&a.market===b.market&&a.side===b.side&&a.line===b.line&&a.quote===b.quote;
function label(g:Match,p:MarketPick){if(p.display)return `${p.market==='total'?(p.side==='over'?'大':'小'):teamZh(g[p.side as 'home'|'away'])} · ${p.display}`;return p.market==='total'?`${p.side==='over'?'大':'小'} ${p.line}`:`${teamZh(g[p.side as 'home'|'away'])} ${signed(p.side==='home'?p.line:-p.line)}`;}
export default function Markets({analysis,games,now,data,error,scheduleOK,odds,oddsError,oddsLoading,refreshOdds}:{analysis:Record<number,AnalysisState>;games:Match[];now:number;data:RunSnapshot|null;error:string;scheduleOK:boolean;odds:OddsSnapshot|null;oddsError:string;oddsLoading:boolean;refreshOdds:()=>Promise<void>}){
 const [mode,setMode]=useState('super007');
 const sourceName=odds?.source==='hr9988'?'SUPER':odds?.source||'自動來源';
 const oddsOK=!oddsError&&fresh(odds?.fetchedAt,now,150000);
 const automatic=mode==='super007';
 const [inputs,setInputs]=useState<Record<number,{spread:string;total:string}>>({});
 const [count,setCount]=useState(3),[picks,setPicks]=useState<MarketPick[]>([]),[notice,setNotice]=useState('');
 const dataOK=!error&&fresh(data?.fetchedAt,now,25*60000);
 const models=useMemo(()=>new Map(games.map(g=>{const runs=data?expectedRuns(g,data):null;return [g.id,runs?{runs,grid:scoreGrid(runs.away,runs.home)}:null];})),[games,data]);
 const fixtures=games.filter(g=>isPregame(g,now));
 const quote=(g:Match,market:'spread'|'total')=>matchOdds(g,odds)?.[market]??null;
 const lines=(g:Match)=>automatic?{spread:quote(g,'spread')?.line.toString()??'',total:quote(g,'total')?.line.toString()??''}:inputs[g.id]||{spread:(models.get(g.id)?.runs.home??0)>=(models.get(g.id)?.runs.away??0)?'-1.5':'1.5',total:'8.5'};
 const parse=(s:string)=>s.trim()===''?null:Number(s);
 function contextConflict(g:Match){const r=analysis[g.id]?.report;return r&&fresh(r.capturedAt,now,300000)&&r.game.away.pitcherId===g.away.pitcherId&&r.game.home.pitcherId===g.home.pitcherId&&r.issues.some(i=>i.includes('衝突')||i.includes('先發投手來源不一致'));}
 function reason(g:Match|undefined){return !g?'已切換日期或賽程已移除':!scheduleOK?'賽程更新中或已過期':!isPregame(g,now)?'已開賽或賽事狀態改變':!dataOK?'得失分資料未齊或已過期':contextConflict(g)?'出賽資料來源衝突，暫停本場推薦':automatic&&!oddsOK?'盤口讀取失敗或已過期，暫停推薦':automatic&&!matchOdds(g,odds)?`未找到唯一對應的 ${sourceName} 賽事`:!models.get(g.id)?'本季得失分樣本不足':'';}
 const result=(p:MarketPick)=>{const g=games.find(g=>g.id===p.gameId),m=models.get(p.gameId);const q=g?quote(g,p.market):null;return g&&!reason(g)&&m&&(!automatic||(q&&q.signature===p.quote&&q.line===p.line))?settle(m.grid,p):null;};
 function add(p:MarketPick){
  if(!result(p))return;
  if(picks.some(x=>same(x,p))){setPicks(picks.filter(x=>x.gameId!==p.gameId));return;}
  const rest=picks.filter(x=>x.gameId!==p.gameId),g=games.find(g=>g.id===p.gameId)!;
  if(rest.length>=count){setNotice(`已選滿 ${count} 關，請先移除。`);return;}
  if(rest.some(x=>{const o=games.find(g=>g.id===x.gameId);return o&&[o.home.id,o.away.id].some(id=>id===g.home.id||id===g.away.id);})){setNotice('同一隊不能跨場重複串，請改選其他比賽。');return;}
  setPicks([...rest,p]);setNotice('已加入；每場限一種玩法，可點另一個方向替換。');
 }
 function update(g:Match,field:'spread'|'total',value:string){setInputs({...inputs,[g.id]:{...lines(g),[field]:value}});if(picks.some(p=>p.gameId===g.id&&p.market===field)){setPicks(picks.filter(p=>!(p.gameId===g.id&&p.market===field)));setNotice('盤口已更改，該關已移除，請重新確認方向。');}}
 function recommend(){
  const candidates=fixtures.filter(g=>!reason(g)).flatMap(g=>marketSuggestions(g,models.get(g.id)!.grid,parse(lines(g).spread),parse(lines(g).total),automatic?{spread:quote(g,'spread'),total:quote(g,'total')}:undefined).map(x=>({...x,pick:{...x.pick,quote:automatic?quote(g,x.pick.market)?.signature:undefined},g}))).sort((a,b)=>(b.result.win+b.result.partialWin)-(a.result.win+a.result.partialWin)||a.g.id-b.g.id);
  const used=new Set<number>(),next:MarketPick[]=[];
  for(const c of candidates){if(used.has(c.g.away.id)||used.has(c.g.home.id))continue;next.push(c.pick);used.add(c.g.away.id);used.add(c.g.home.id);if(next.length===count)break;}
  setPicks(next);setNotice(next.length<count?`符合條件只有 ${next.length} 場，不勉強湊滿。`:'已按各方向的模型獲利機率（含中洞贏）排序；未比較賠率價值。');
 }
 const outcomes=picks.map(result),valid=picks.length===count&&outcomes.every(Boolean);
 const combined=valid?outcomes.reduce((n,r)=>n*r!.win,1):null;
 return <section className="space-y-4" aria-label="讓分與大小推薦">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-black">讓分・大小推薦</h3></div>

  </div>
  <div className="flex flex-wrap items-center gap-3"><Select value={mode} onValueChange={v=>{setMode(v);setPicks([]);setNotice('已切換模式，請重新選關。');}}><SelectTrigger aria-label="盤口來源"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="super007">{sourceName} 盤口</SelectItem><SelectItem value="manual">自訂盤口試算</SelectItem></SelectContent></Select><Button variant="outline" disabled={oddsLoading} onClick={()=>void refreshOdds()}>{oddsLoading?'讀取中…':'更新盤口'}</Button><span className="text-sm text-slate-400">抓取：{odds?.fetchedAt?new Date(odds.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'尚未取得'}（台灣）・來源可能延遲</span></div>
  {automatic&&!oddsOK&&<p role="status" className="text-sm text-amber-200">{oddsError||'盤口尚未取得或已過期，暫停推薦。'} 舊資料不參與推薦。</p>}
  <p className="text-sm text-slate-400">{sourceName} 原始主盤每分鐘讀取；支援整分、半分、拆分盤與加減比例。全贏、中洞贏、走盤與中洞輸分開計算。</p>
  {!dataOK&&<p role="status" className="text-sm text-amber-200">{error||'正在取得球隊得失分資料，暫停推薦。'}</p>}
  <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="space-y-4">
   {!fixtures.length&&<p className="panel p-5 text-slate-400">這個日期沒有可分析的未開賽場次，請切換上方日期。</p>}
   {fixtures.map(g=>{const m=models.get(g.id),input=lines(g),blocked=reason(g);const rec=!blocked&&m?marketSuggestions(g,m.grid,parse(input.spread),parse(input.total),automatic?{spread:quote(g,'spread'),total:quote(g,'total')}:undefined).map(x=>({...x,pick:{...x.pick,quote:automatic?quote(g,x.pick.market)?.signature:undefined}})):[];
    return <article className="panel overflow-hidden" key={g.id}><div className="border-b border-white/10 p-4"><p className="mb-2 text-sm text-slate-400">{new Date(g.date).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}（台灣）</p><h4 className="font-bold">{teamZh(g.away)}（客）vs {teamZh(g.home)}（主）</h4><p className="mt-2 text-sm text-slate-400">{m&&!blocked?`九局得分期望：客 ${m.runs.away.toFixed(1)}／主 ${m.runs.home.toFixed(1)}，合計 ${(m.runs.away+m.runs.home).toFixed(1)} 分`:'等待有效資料'}</p></div>
     <div className="grid gap-4 p-4 md:grid-cols-2">{(['spread','total'] as const).map(market=>{const raw=input[market],line=parse(raw),bad=line===null||!validLine(market,line);const sides=market==='spread'?['home','away'] as const:['over','under'] as const;return <div key={market} className="space-y-3"><label className="block text-sm font-bold" htmlFor={`${market}-${g.id}`}>{market==='spread'?'主隊讓分（負數＝讓分）':'全場大小分'}</label><Input id={`${market}-${g.id}`} type={automatic?"text":"number"} step="0.25" min={market==='spread'?-10:.5} max={market==='spread'?10:30} value={automatic?quote(g,market)?.display??raw:raw} readOnly={automatic} placeholder={automatic?"暫無開放主盤":"輸入盤口"} onChange={e=>update(g,market,e.target.value)}/>{!automatic&&<p className="text-sm text-slate-400">{inputs[g.id]?'自訂參考線・請核對實際盤口':'預設參考線・非即時盤口'}</p>}{bad&&<p role="alert" className="text-sm text-amber-200">{automatic?(oddsError||matchOdds(g,odds)?.issues?.[market]||'尚未找到可對應本場的來源主盤。'):market==='spread'?'請輸入 -10 至 +10 的整分或半分。':'請輸入 0.5 至 30 的整分或半分。'}</p>}
       {sides.map(side=>{const p:MarketPick={gameId:g.id,market,side,line:line??NaN,boundary:automatic?quote(g,market)?.boundary:undefined,parts:automatic?quote(g,market)?.parts:undefined,display:automatic?quote(g,market)?.display:undefined,quote:automatic?quote(g,market)?.signature:undefined},r=!blocked&&!bad&&m?settle(m.grid,p):null,active=picks.some(x=>same(x,p)),recommended=rec.some(x=>same(x.pick,p));return <Button key={side} variant={active?'default':'outline'} disabled={!r} aria-pressed={active} className="h-auto w-full items-start whitespace-normal p-3 text-left" onClick={()=>add(p)}><span className="block w-full"><span className="block font-bold">{bad?(market==='total'?(side==='over'?'大分':'小分'):teamZh(g[side as 'home'|'away'])):label(g,p)}{automatic&&quote(g,market)?` @${(side==='home'||side==='over'?quote(g,market)!.first:quote(g,market)!.second).toFixed(3)}`:''}{recommended?'・推薦':''}{active?' ✓':''}</span><span className="mt-2 block text-sm">{r?`全贏 ${pct(r.win)}・中洞贏 ${pct(r.partialWin)}・中洞輸 ${pct(r.partialLoss)}・全輸 ${pct(r.loss)}`:'尚無估算'}</span></span></Button>;})}
       {!blocked&&!bad&&!rec.some(x=>x.pick.market===market)&&<p className="text-sm text-slate-400">兩方接近，暫不推薦。</p>}
      </div>;})}</div>{blocked&&<p className="px-4 pb-4 text-sm text-amber-200">{blocked}</p>}</article>;
   })}
  </div><aside className="panel space-y-4 p-5 xl:sticky xl:top-24"><h3 className="text-lg font-black">讓分／大小混合串關</h3><Select value={String(count)} onValueChange={v=>{setCount(Number(v));setPicks(p=>p.slice(0,Number(v)));}}><SelectTrigger aria-label="讓分大小串關數量" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{[3,4,5].map(n=><SelectItem key={n} value={String(n)}>{n} 關</SelectItem>)}</SelectContent></Select><Button className="w-full" disabled={!dataOK||!scheduleOK||!fixtures.length||(automatic&&!oddsOK)} onClick={recommend}>推薦 {count} 關</Button><p className="text-sm text-slate-400">依目前盤口與模型獲利機率（含中洞贏）推薦，點選方向可換關；每場限一項，同隊不重複串。</p><p className="text-sm text-amber-200" aria-live="polite">{notice}</p><p className="font-bold">已選 {picks.length}／{count} 關</p>
   {picks.map(p=>{const g=games.find(g=>g.id===p.gameId),r=result(p);return <div key={p.gameId} className="rounded-lg border border-white/10 p-3"><div className="flex justify-between gap-2"><strong>{g?label(g,p):'賽事已失效'}</strong><button className="text-sm underline" onClick={()=>setPicks(picks.filter(x=>x.gameId!==p.gameId))}>移除</button></div>{g&&<p className="mt-2 text-sm text-slate-400">{teamZh(g.away)} vs {teamZh(g.home)}</p>}<p className="mt-2 text-sm text-amber-200">{r?`全贏 ${pct(r.win)}／中洞贏 ${pct(r.partialWin)}／中洞輸 ${pct(r.partialLoss)}／全輸 ${pct(r.loss)}`:reason(g)||'盤口或賠率已變動，請移除並重新選擇'}</p></div>;})}
   <div className="rounded-lg bg-[#ffd538]/10 p-4"><p className="text-sm">全關全贏・獨立假設試算</p><p className="my-2 text-3xl font-black text-[#ffd538]">{combined===null?'—':pct(combined)}</p><p className="text-sm text-slate-400">{combined===null?'選滿有效關卡後顯示。':''} 尚未校準，不代表實際命中率。</p></div><Button variant="outline" className="w-full" disabled={!picks.length} onClick={()=>{setPicks([]);setNotice('已清空。');}}>清空組合</Button>
  </aside></div>
 </section>;
}
