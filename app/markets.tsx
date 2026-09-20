"use client";
import {useMemo,useState,type ReactNode} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {fresh,isPregame,type Match} from '@/lib/baseball';
import {orderMatchCards} from '@/lib/match-card-order';
import {expectedRuns,scoreGrid,validLine,type RunSnapshot} from '@/lib/markets';
import {matchOdds,type OddsSnapshot,type Quote,type MarketKey} from '@/lib/pinnacle';
import {BOARD_MARKETS,boardQuote,boardSides,boardMarketLabel,isHalfMarket,makeBoardPick,sameBoardPick,settleBoard,type BoardPick} from '@/lib/board-markets';
import {formatSpreadLine,formatPickLine} from '@/lib/market-display';
import {marketContextStatus} from '@/lib/pregame-readiness';
import type {AnalysisState} from './game-context';
import TeamName from './team-name';
import MarketOutcomes from './market-outcomes';
import ParlayPane from './parlay-pane';

const pct=(p:number)=>(p*100).toFixed(1)+'%';
const optionName=(g:Match,p:BoardPick)=>p.key==='firstHalfOddEven'?(p.side==='over'?'單':'雙'):p.market==='total'?(p.side==='over'?'大':'小'):<TeamName team={g[p.side as 'home'|'away']}/>;
function label(g:Match,p:BoardPick){return <>{boardMarketLabel(p.key)} · {optionName(g,p)} {p.key==='firstHalfOddEven'?'':formatPickLine(p)}</>;}

export default function Markets({analysis,games,now,data,error,scheduleOK,scheduleMessage,odds,oddsError,oddsLoading,refreshOdds,renderMatchHeader,renderWinnerOptions,winnerPanel,parlayMode,onParlayModeChange}:{analysis:Record<number,AnalysisState>;games:Match[];now:number;data:RunSnapshot|null;error:string;scheduleOK:boolean;scheduleMessage:string;odds:OddsSnapshot|null;oddsError:string;oddsLoading:boolean;refreshOdds:()=>Promise<void>;renderMatchHeader:(game:Match,expectedRunsInfo:ReactNode)=>ReactNode;renderWinnerOptions:(game:Match)=>ReactNode;winnerPanel:ReactNode;parlayMode:'markets'|'winner';onParlayModeChange:(mode:'markets'|'winner')=>void}){
 const [mode,setMode]=useState('super007');
 const [inputs,setInputs]=useState<Record<number,{spread:string;total:string}>>({});
 const [marketTabs,setMarketTabs]=useState<Record<number,MarketKey>>({});
 const [count,setCount]=useState(3),[picks,setPicks]=useState<BoardPick[]>([]),[notice,setNotice]=useState('');
 const sourceName=odds?.source==='hr9988'?'SUPER':odds?.source||'自動來源';
 const oddsOK=!oddsError&&fresh(odds?.fetchedAt,now,150000),automatic=mode==='super007';
 const dataOK=!error&&fresh(data?.fetchedAt,now,25*60000);
 const models=useMemo(()=>new Map(games.map(g=>{
  const runs=data?expectedRuns(g,data):null;
  // Keep the established full-game calculation. First-half estimates use five
  // of nine innings at the same scoring rate and keep ties without extra innings.
  return [g.id,runs?{runs,full:scoreGrid(runs.away,runs.home),half:scoreGrid(runs.away*5/9,runs.home*5/9,false)}:null];
 })),[games,data]);
 const fixtures=games.filter(g=>isPregame(g,now));
 const manualLines=(g:Match)=>inputs[g.id]||{spread:(models.get(g.id)?.runs.home??0)>=(models.get(g.id)?.runs.away??0)?'-1.5':'1.5',total:'8.5'};
 function quote(g:Match,key:MarketKey):Quote|null{
  if(automatic)return boardQuote(matchOdds(g,odds),key);
  if(key!=='spread'&&key!=='total')return null;
  const raw=manualLines(g)[key],line=raw.trim()===''?NaN:Number(raw);
  return validLine(key,line)?{line,first:0,second:0,signature:JSON.stringify(['manual',g.id,key,line])}:null;
 }
 function reason(g:Match|undefined){
  return !g?'已切換日期或賽程已移除':!scheduleOK?'賽程更新中或已過期':!isPregame(g,now)?'已開賽或賽事狀態改變':!dataOK?'得失分資料未齊或已過期':marketContextStatus(g,analysis[g.id]?.report,now).blocked||(automatic&&!oddsOK?'資料讀取失敗或已過期，暫停推薦':automatic&&!matchOdds(g,odds)?'尚未開盤':!models.get(g.id)?'本季得失分樣本不足':'');
 }
 function result(p:BoardPick){
  const g=games.find(g=>g.id===p.gameId),model=models.get(p.gameId),q=g?quote(g,p.key):null;
  return g&&!reason(g)&&model&&q&&q.signature===p.quote&&q.line===p.line?settleBoard(isHalfMarket(p.key)?model.half:model.full,p):null;
 }
 function options(g:Match,key:BoardPick['key']){
  const q=quote(g,key);if(!q)return [];
  return boardSides(key).map(side=>{const pick=makeBoardPick(g.id,key,side,q);return {pick,result:result(pick)};});
 }
 function preferred(rows:ReturnType<typeof options>){
  return rows.filter(x=>x.result&&x.result.win+x.result.partialWin>x.result.loss+x.result.partialLoss+.000001)
   .sort((a,b)=>(b.result!.win+b.result!.partialWin)-(a.result!.win+a.result!.partialWin))[0]?.pick;
 }
 function add(p:BoardPick){
  if(!result(p))return;onParlayModeChange('markets');
  if(picks.some(x=>sameBoardPick(x,p))){setPicks(picks.filter(x=>x.gameId!==p.gameId));return;}
  const rest=picks.filter(x=>x.gameId!==p.gameId),g=games.find(g=>g.id===p.gameId)!;
  if(rest.length>=count){setNotice(`已選滿 ${count} 關，請先移除。`);return;}
  if(rest.some(x=>{const other=games.find(g=>g.id===x.gameId);return other&&[other.home.id,other.away.id].some(id=>id===g.home.id||id===g.away.id);})){setNotice('同一隊不能跨場重複串，請改選其他比賽。');return;}
  setPicks([...rest,p]);setNotice('已加入；每場限一種玩法，可點另一個方向替換。');
 }
 function update(g:Match,field:'spread'|'total',value:string){
  setInputs({...inputs,[g.id]:{...manualLines(g),[field]:value}});
  if(picks.some(p=>p.gameId===g.id&&p.key===field)){setPicks(picks.filter(p=>!(p.gameId===g.id&&p.key===field)));setNotice('資料已更改，該關已移除，請重新確認方向。');}
 }
 function recommend(){
  const candidates=fixtures.filter(g=>!reason(g)).flatMap(g=>BOARD_MARKETS.flatMap(({key})=>{
   if(key==='moneyline')return [];const rows=options(g,key),p=preferred(rows),r=p?rows.find(x=>x.pick===p)?.result:null;return p&&r?[{g,p,r}]:[];
  })).sort((a,b)=>(b.r.win+b.r.partialWin)-(a.r.win+a.r.partialWin)||a.g.id-b.g.id);
  const used=new Set<number>(),next:BoardPick[]=[];
  for(const c of candidates){if(used.has(c.g.away.id)||used.has(c.g.home.id))continue;next.push(c.p);used.add(c.g.away.id);used.add(c.g.home.id);if(next.length===count)break;}
  setPicks(next);setNotice(next.length<count?`符合條件只有 ${next.length} 場，不勉強湊滿。`:'已按各玩法的模型獲利機率（含中洞贏）排序。');
 }
 const outcomes=picks.map(result),valid=picks.length===count&&outcomes.every(Boolean);
 const combined=valid?outcomes.reduce((n,r)=>n*r!.win,1):null;
 const orderedGames=orderMatchCards(games,g=>isPregame(g,now)?matchOdds(g,odds):null,oddsOK);
 function marketPanel(g:Match,key:BoardPick['key']){
  const q=quote(g,key),rows=options(g,key),recommended=preferred(rows),blocked=reason(g);
  const sourceIssue=matchOdds(g,odds)?.issues?.[key];
  return <section className="space-y-3" aria-label={boardMarketLabel(key)}>
   <h5 className="font-bold">{boardMarketLabel(key)}</h5>
   {(key==='spread'||key==='total')&&!automatic?<><Input aria-label={boardMarketLabel(key)+'自訂數值'} type="number" step="0.25" min={key==='spread'?-10:.5} max={key==='spread'?10:30} value={manualLines(g)[key]} onChange={e=>update(g,key,e.target.value)}/><p className="text-sm text-slate-400">自訂參考線 請核對實際數值</p></>:q&&key!=='firstHalfOddEven'?<p className="market-line">{key==='total'||key==='firstHalfTotal'?q.display??q.line:formatSpreadLine(q,'home')}</p>:null}
   <div className="grid gap-3 md:grid-cols-2">{boardSides(key).map(side=>{
    const row=rows.find(x=>x.pick.side===side),p=row?.pick,r=row?.result,active=!!p&&picks.some(x=>sameBoardPick(x,p));
    const title=key==='firstHalfOddEven'?(side==='over'?'單':'雙'):key==='total'||key==='firstHalfTotal'?(side==='over'?'大':'小'):<TeamName team={g[side as 'home'|'away']}/>;
    return <Button key={side} variant={active?'default':'outline'} disabled={!p||!r} aria-pressed={active} className="market-option-card h-auto w-full items-start whitespace-normal p-3 text-left" onClick={()=>p&&add(p)}><span className="block w-full">
     <span className="market-pick-title flex w-full flex-wrap items-start justify-between gap-x-3 gap-y-1 font-bold"><span className="min-w-0">{title}{p&&recommended&&sameBoardPick(p,recommended)&&<span className={`ml-2 ${active?'text-green-700':'text-green-400'}`}>推薦</span>}{active&&<span className="ml-1 text-green-700" aria-label="已選取">✓</span>}</span>
      {p&&q&&<span className="ml-auto whitespace-nowrap text-right tabular-nums">{key==='firstHalfOddEven'?'':formatPickLine(p)}{automatic?` @${(side==='home'||side==='over'?q.first:q.second).toFixed(3)}`:''}</span>}
     </span><span className="mt-3 block text-sm">{r?<MarketOutcomes outcome={r}/>:q?'尚無估算':'尚未開盤'}</span>
    </span></Button>;
   })}</div>
   {!q&&<p className="text-sm text-amber-200">{automatic?(oddsError||(sourceIssue?.startsWith('來源沒有開放的主盤')?'尚未開盤':sourceIssue)||'尚未開盤'):'請輸入有效的自訂數值。'}</p>}
   {blocked&&q&&<p className="text-sm text-amber-200">{blocked}</p>}
  </section>;
 }
 return <section className="arena-analysis-board" aria-label="每日對戰勝率分析">
  <div className="arena-analysis-controls space-y-4">
  <h3 className="text-xl font-black">每日對戰 勝率分析</h3>
  <div className="flex flex-wrap items-center gap-3"><Select value={mode} onValueChange={v=>{setMode(v);setPicks([]);setMarketTabs({});setNotice('已切換模式，請重新選關。');}}><SelectTrigger aria-label="資料來源"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="super007">{sourceName} 資料</SelectItem><SelectItem value="manual">自訂數值試算</SelectItem></SelectContent></Select><Button variant="outline" disabled={oddsLoading} onClick={()=>void refreshOdds()}>{oddsLoading?'讀取中…':'更新資料'}</Button><span className="text-sm text-white">抓取：{odds?.fetchedAt?new Date(odds.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'尚未取得'}（台灣） 來源可能延遲</span></div>
  {automatic&&!oddsOK&&<p role="status" className="text-sm text-amber-200">{oddsError||'資料尚未取得或已過期，暫停推薦。'} 舊資料不參與推薦。</p>}
  {!dataOK&&<p role="status" className="text-sm text-amber-200">{error||'正在取得球隊得失分資料，暫停推薦。'}</p>}
  </div>
  <div className="arena-analysis-summary"><ParlayPane><aside className="panel space-y-4 p-5"><h3 className="text-lg font-black">串關組合</h3><Tabs value={parlayMode} onValueChange={v=>onParlayModeChange(v as 'markets'|'winner')}><TabsList className="mb-3 h-auto min-h-10 w-full" aria-label="選擇串關玩法"><TabsTrigger value="markets">分析</TabsTrigger><TabsTrigger value="winner">獨贏</TabsTrigger></TabsList><TabsContent value="markets" className="parlay-compact-content space-y-2">
   <div className="parlay-compact-controls">
   <Select value={String(count)} onValueChange={v=>{setCount(Number(v));setPicks(p=>p.slice(0,Number(v)));}}><SelectTrigger aria-label="串關數量" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{[3,4,5].map(n=><SelectItem key={n} value={String(n)}>{n} 關</SelectItem>)}</SelectContent></Select>
   <Button className="w-full" disabled={!dataOK||!scheduleOK||!fixtures.length||(automatic&&!oddsOK)} onClick={recommend}>推薦 {count} 關</Button></div>
   <details className="parlay-explanation"><summary>試算說明</summary><p className="text-sm text-slate-400">依目前資料與模型獲利機率（含中洞贏）推薦，點選方向可換關；每場限一項，同隊不重複串。</p></details><p className="parlay-notice text-sm text-amber-200" aria-live="polite">{notice}</p><p className="font-bold">已選 {picks.length}／{count} 關</p>
   {picks.map(p=>{const g=games.find(g=>g.id===p.gameId),r=result(p);return <div key={p.gameId} className="rounded-lg border border-white/10 p-3"><div className="flex justify-between gap-2"><strong>{g?label(g,p):'賽事已失效'}</strong><button className="text-sm underline" onClick={()=>setPicks(picks.filter(x=>x.gameId!==p.gameId))}>移除</button></div>{g&&<p className="mt-2 text-sm text-slate-400"><TeamName team={g.away} size={20}/> vs <TeamName team={g.home} size={20}/></p>}<div className="mt-2 text-sm text-amber-200">{r?<MarketOutcomes outcome={r}/>:reason(g)||'資料或賠率已變動，請移除並重新選擇'}</div></div>;})}
   <div className="parlay-compact-result rounded-lg bg-[#ffd538]/10 p-4"><p className="text-sm">全關全贏 獨立試算</p><p className="my-2 text-3xl font-black text-[#ffd538]">{combined===null?'—':pct(combined)}</p></div><Button variant="outline" className="w-full" disabled={!picks.length} onClick={()=>{setPicks([]);setNotice('已清空。');}}>清空組合</Button>
  </TabsContent><TabsContent value="winner">{winnerPanel}</TabsContent></Tabs></aside></ParlayPane></div>
  <div className="arena-analysis-games arena-market-layout space-y-4">
   {!games.length&&<p className="panel p-5 text-slate-400">{scheduleMessage||'這個台灣日期沒有賽事，請切換上方日期。'}</p>}
   {orderedGames.map(g=>{
    const m=models.get(g.id),blocked=reason(g),selected=marketTabs[g.id]??'spread';
    return <article className="panel overflow-hidden" key={g.id} data-game-id={g.id}>
     <div className="p-4">{renderMatchHeader(g,isPregame(g,now)?<span className="tabular-nums">{m&&!blocked?`九局得分期望：客 ${m.runs.away.toFixed(1)}／主 ${m.runs.home.toFixed(1)}，合計 ${(m.runs.away+m.runs.home).toFixed(1)} 分`:'得分期望：等待有效資料'}</span>:null)}</div>
     {isPregame(g,now)&&<details className="match-market-details"><summary><span>查看分析</span><span className="text-sm font-normal">{automatic?'7 種玩法':'自訂數值'}</span></summary><div className="space-y-4 p-4">
      <Tabs value={selected} onValueChange={value=>setMarketTabs(old=>({...old,[g.id]:value as MarketKey}))}>
       <div className="market-tabs-scroll"><TabsList className="market-type-tabs" aria-label="選擇玩法">{BOARD_MARKETS.filter(({key})=>automatic||key==='spread'||key==='total'||key==='moneyline').map(({key,label})=><TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}</TabsList></div>
       <TabsContent value={selected} className="pt-4">{selected==='moneyline'?renderWinnerOptions(g):marketPanel(g,selected)}</TabsContent>
      </Tabs>
     </div></details>}
    </article>;
   })}
  </div>
 </section>;
}
