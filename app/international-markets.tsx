'use client';
import {useEffect,useMemo,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {RefreshCw} from 'lucide-react';
import ParlayPane from './parlay-pane';
import {BOARD_MARKETS} from '@/lib/board-markets';
import type {MarketKey} from '@/lib/pinnacle';
import {INTERNATIONAL_MARKET_SOURCE,internationalMarketOptions,type InternationalPick} from '@/lib/international-market-options';
import InternationalMarketAnalysis from './international-market-analysis';
import InternationalTeamLogo from './international-team-logo';
import {buildRunAnalysis,matchingRunAnalysis,analysisFixtureKey,suggestedPicks,isModelLeague} from '@/lib/baseball-run-analysis';
import {announcedNpbGames,scheduledKboGames} from '@/lib/international-fixtures';
import {selectInternationalBoardFixtures} from '@/lib/international-board-fixtures';
import {internationalTeam} from '@/lib/international-teams';
import {mergePregameFixtures,displayPitcherStat,type PregameData} from '@/lib/international-pregame';
type Pick=InternationalPick;
type SourceTable={title:string;headers:string[];rows:string[][]};
type ScheduleData={tables?:SourceTable[];status?:string;games?:{id:string;label:string;date?:string}[];fetchedAt?:string;error?:string};
type StandingsData={tables?:SourceTable[]};
const cleanTeam=(name:string)=>name.replace(/\s*[（(](?:主|客)[）)]\s*/g,'').trim();
function scheduleGame(g:{id:string;label:string;date?:string}){
 const match=g.label.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+·\s+(.+?)（客）\s+(?:vs|\d+：\d+)\s+(.+?)（主）/);
 return match?{id:`schedule-${g.id}`,sourceId:g.id,start:`${match[1]} ${match[2]}:00`,away:match[3],home:match[4],live:false,displayMarkets:[]}:null;
}
export default function InternationalMarkets({league,schedule,standings,starters,pregame,odds,dataLoading,onRefreshData,onDateChange}:{onDateChange?:(date:string)=>void;dataLoading:boolean;onRefreshData:()=>void;odds:{data:any;error:string;loading:boolean;refresh:()=>Promise<void>};league:string;schedule?:ScheduleData;standings?:StandingsData;starters?:StandingsData&{fetchedAt?:string;status?:string};pregame?:PregameData}){
 const {data,error,loading:busy,refresh}=odds;
 const [now,setNow]=useState(Date.now());
 const [day,setDay]=useState('auto'),[count,setCount]=useState(3),[parlayMode,setParlayMode]=useState('markets'),[notice,setNotice]=useState('');
 const [picks,setPicks]=useState<Pick[]>([]),[stake,setStake]=useState('100');
 const [marketTabs,setMarketTabs]=useState<Record<string,MarketKey>>({});
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
 const modelLeague=isModelLeague(league)?league:'NPB',hasModel=isModelLeague(league);
 const analysisReports=useMemo(()=>new Map(hasModel?(pregame?.games||[]).map(g=>{const report=buildRunAnalysis(g,Date.now(),modelLeague);return [analysisFixtureKey(report.fixture,modelLeague),report] as const;}):[]),[hasModel,modelLeague,pregame]);
 const fresh=!!data?.fetchedAt&&now-Date.parse(data.fetchedAt)<=150000&&now-Date.parse(data.fetchedAt)>=-60000&&!error;
 const options=(g:any,selectedPeriod='full',selectedType='103')=>internationalMarketOptions(g,league,selectedPeriod,selectedType);
 const hasOptions=(g:any)=>BOARD_MARKETS.some(({key})=>{const s=INTERNATIONAL_MARKET_SOURCE[key];return options(g,s.period,s.type).length>0;});
 const teamName=(name:string)=>internationalTeam(cleanTeam(name),league);
 const sourceGames=(data?.games||[]).map((g:any)=>({...g,oddsSource:true}));
 const currentFixtures=(league==='NPB'?announcedNpbGames(starters?.tables):league==='KBO'?scheduledKboGames(schedule?.tables):(schedule?.games||[]).map(scheduleGame).filter(Boolean)) as any[];
 const listed=mergePregameFixtures(currentFixtures,pregame,league,currentFixtures) as any[];
 const {games,days,automaticDay,targetDay}=selectInternationalBoardFixtures(listed,sourceGames,league,now,day,pregame?.excludedFixtures,hasOptions);
 useEffect(()=>{if(targetDay)onDateChange?.(targetDay)},[targetDay,onDateChange]);
 useEffect(()=>{setDay('auto');setPicks([]);setMarketTabs({})},[league]);
 const record=(name:string)=>{for(const table of standings?.tables||[]){const hi=table.headers.indexOf('球隊'),wi=table.headers.indexOf('勝'),li=table.headers.indexOf('敗');const row=table.rows.find(r=>hi>=0&&teamName(r[hi])===teamName(name));if(row)return wi>=0&&li>=0?`${row[wi]} 勝 ${row[li]} 敗`:'';}return '';};
 const valid=picks.length>0&&fresh&&picks.every(p=>{const g=games.find((g:any)=>g.id===p.event);return g&&!g.live&&Date.parse(g.start.replaceAll('/','-').replace(' ','T')+'+08:00')>now&&options(g,p.period,p.type).some(o=>o.key===p.key&&o.signature===p.signature);});
 const amount=Number(stake),net=picks.reduce((v,p)=>v*(1+p.price),1);
 function recommend(){
  const selected=suggestedPicks(games,analysisReports,now,fresh,parlayMode==='winner',modelLeague).slice(0,count);
  if(selected.length<count){setNotice(`目前只有 ${selected.length} 場可推薦，未滿 ${count} 關。`);return;}
  setPicks(selected);setNotice('已選取，每場一項。');
 }
 function changeMode(value:string){setParlayMode(value);setMarketTabs({});setPicks([]);setNotice('');}
 function addPick(p:Pick){
  if(picks.some(x=>x.key===p.key)){setPicks(picks.filter(x=>x.key!==p.key));setNotice('');return;}
  const next=picks.filter(x=>x.event!==p.event);
  if(next.length>=count){setNotice(`已選滿 ${count} 關，請先移除。`);return;}
  setPicks([...next,p]);setNotice('');
 }
 return <section className="mb-6 space-y-5" aria-label="賽前分析與自選串關">
  <div className="arena-pregame-toolbar flex flex-wrap items-center gap-3">
   <Button variant="outline" disabled={dataLoading} onClick={onRefreshData}><RefreshCw className={dataLoading?'animate-spin':''}/>更新球隊數據</Button>
   <Select value={day} onValueChange={value=>{setDay(value);setPicks([]);setNotice('');}}><SelectTrigger aria-label="選擇台灣賽事日期"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="auto">自動 {automaticDay||'等待賽程'}（台灣）</SelectItem>{days.map(value=><SelectItem key={value} value={value}>{value}（台灣）</SelectItem>)}</SelectContent></Select>
  </div>
  <section className="arena-analysis-board" aria-label="每日對戰勝率分析">
   <div className="arena-analysis-controls space-y-4">
    <h3 className="text-xl font-black">每日對戰 勝率分析</h3>
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy} onClick={()=>void refresh()}>{busy?'讀取中…':'更新資料'}</Button></div>
    {error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}
   </div>
   <div className="arena-analysis-summary"><ParlayPane><aside className="panel space-y-4 p-5">
    <h3 className="text-lg font-black">串關組合</h3>
    <Tabs value={parlayMode} onValueChange={changeMode}><TabsList className="mb-3 h-auto min-h-10 w-full" aria-label="選擇串關玩法"><TabsTrigger value="markets">分析</TabsTrigger><TabsTrigger value="winner">獨贏</TabsTrigger></TabsList>
     <TabsContent value={parlayMode} className="parlay-compact-content space-y-2">
      <div className="parlay-compact-controls"><Select value={String(count)} onValueChange={value=>{setCount(Number(value));setPicks(old=>old.slice(0,Number(value)));setNotice('');}}><SelectTrigger aria-label="串關數量" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{[3,4,5].map(n=><SelectItem key={n} value={String(n)}>{n} 關</SelectItem>)}</SelectContent></Select><Button className="w-full" disabled={!hasModel||!fresh||!games.some(g=>!g.live&&Date.parse(g.start.replace(' ','T')+'+08:00')>now)} onClick={recommend} aria-describedby={`${league}-recommend-status`}>推薦 {count} 關</Button></div>
      <details className="parlay-explanation"><summary>試算說明</summary><div className="mt-2 space-y-3"><p id={`${league}-recommend-status`}>{hasModel?'每場限一項；選項不足時不會湊滿關數。':'分析資料未齊，暫停自動推薦。可使用來源開放的報價手動選關，每場限一項。'}</p><label className="block text-sm">試算金額<Input type="number" min="0" value={stake} onChange={e=>setStake(e.target.value)}/></label><p>全贏返還包含本金；不含走盤、輸贏半或百分比結算。此處僅試算，不會送出投注。</p></div></details>
      <p className="parlay-notice text-sm text-amber-200" aria-live="polite">{notice}</p><p className="font-bold">已選 {picks.length}／{count} 關</p>
      {picks.map(p=><div key={p.key} className="rounded-lg border border-white/10 p-3"><p className="mb-1 text-sm text-slate-400">{BOARD_MARKETS.find(({key})=>INTERNATIONAL_MARKET_SOURCE[key].period===p.period&&INTERNATIONAL_MARKET_SOURCE[key].type===p.type)?.label}</p><div className="flex justify-between gap-2"><strong>{p.label} · {p.price}</strong><button className="text-sm underline" onClick={()=>setPicks(old=>old.filter(x=>x.key!==p.key))}>移除</button></div></div>)}
      <div className="parlay-compact-result rounded-lg bg-[#ffd538]/10 p-4"><p className="text-sm">全關全贏 試算返還</p><p className="my-2 text-3xl font-black text-[#ffd538]">{valid&&picks.length===count&&amount>=0&&Number.isFinite(amount)?`NT$ ${(amount*net).toFixed(2)}`:'—'}</p></div>
      {picks.length>0&&!valid&&<p className="text-amber-200 text-sm">選項已過期、變盤或開賽，請重新選取。</p>}
      <Button variant="outline" className="w-full" disabled={!picks.length} onClick={()=>{setPicks([]);setNotice('已清空。');}}>清空組合</Button>
     </TabsContent>
    </Tabs>
   </aside></ParlayPane></div>
   <div className="arena-analysis-games arena-market-layout space-y-4">
    {games.map((g:any)=>{const selected=marketTabs[g.id]??(parlayMode==='winner'?'moneyline':'spread'),source=INTERNATIONAL_MARKET_SOURCE[selected];const currentPeriod=source.period,currentType=source.type;const opts=options(g,currentPeriod,currentType);const started=g.live||!Number.isFinite(Date.parse(g.start.replaceAll('/','-').replace(' ','T')+'+08:00'))||Date.parse(g.start.replaceAll('/','-').replace(' ','T')+'+08:00')<=now;
     const marketStatus=started?'已開賽，暫停賽前選關。':error?'盤口連線失敗，請更新資料。':busy&&!fresh?'正在讀取本場盤口…':!fresh?'盤口資料等待更新。':opts.length?'':!g.oddsSource?'本次尚未取得可配對的盤口。':!(g.displayMarkets||[]).some((m:any)=>m.period===currentPeriod&&m.type===Number(currentType))?'本次未取得本玩法盤口，請更新資料。':'本玩法目前封盤，或主盤報價尚不完整。';
     const analysis=hasModel?matchingRunAnalysis(g,analysisReports,now,modelLeague):null;
     return <article key={g.id} className="panel international-match-card overflow-hidden">
     <div className="flex flex-wrap justify-between gap-2 px-5 pt-4 text-sm text-slate-400"><span>{g.start}（台灣）{g.venue?` · ${g.venue}`:''}</span><span>{analysis?.expected?`九局得分期望：客 ${analysis.expected.away.toFixed(1)}／主 ${analysis.expected.home.toFixed(1)}，合計 ${(analysis.expected.away+analysis.expected.home).toFixed(1)} 分${analysis.win?` · 和局 ${(analysis.win.draw*100).toFixed(1)}%`:''}`:'得分期望：等待有效資料'}</span></div>
     <div className="international-match-teams">{(['away','home'] as const).map(side=><div key={side} className="international-match-team"><div className="international-match-name">{league!=='CPBL'&&<InternationalTeamLogo league={league} name={cleanTeam(g[side])} size={34}/>}<h2>{cleanTeam(g[side])}<small>（{side==='home'?'主':'客'}）</small></h2><span><small>勝率</small>{started?'已開賽':analysis?.win?`${(analysis.win[side]*100).toFixed(1)}%`:hasModel?'—':'待分析'}</span></div><p>{record(g[side])||(g.pregame?.[side].record?`來源戰績 ${g.pregame[side].record}`:'戰績資料更新中')}</p><p>預計先發：<strong>{g.starters?.[side]||'尚未公布'}</strong>　 本季防禦率 <strong>{displayPitcherStat(g.pregame?.[side],'era')}</strong>　 本季 WHIP <strong>{displayPitcherStat(g.pregame?.[side],'whip')}</strong></p></div>)}</div>
     <InternationalMarketAnalysis league={league} game={g} market={selected} onMarketChange={key=>setMarketTabs(old=>({...old,[g.id]:key}))} picks={picks} onPick={addPick} canPick={fresh&&!started} status={marketStatus} analysis={analysis} quotesFresh={fresh&&!started}/>
    </article>;})}
    {!games.length&&<div className="panel p-5">{dataLoading?`正在取得 ${league} 賽程…`:`${targetDay||'目前'} 尚無可顯示的 ${league} 賽事，請切換日期或更新資料。`}</div>}
   </div>
  </section>
 </section>;
}
