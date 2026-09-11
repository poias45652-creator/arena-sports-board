"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs,TabsList,TabsTrigger,TabsContent } from '@/components/ui/tabs';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { Table,TableHeader,TableRow,TableHead,TableBody,TableCell } from '@/components/ui/table';
import { RefreshCw,Layers } from 'lucide-react';
import { baseProbability,fresh,isPregame,shiftDay,suggest,taipeiDay,type Kind,type Leg,type Match,type Schedule,type Snapshot,type StatRow } from '@/lib/baseball';
import Markets from './markets';
import {superOdds,type SuperSnapshot} from '@/lib/super007';
import GameContext,{type AnalysisState} from './game-context';
import {useSource} from './use-source';
import type { OddsSnapshot } from '@/lib/pinnacle';
import type { RunSnapshot } from '@/lib/markets';
import { teamZh } from './zh';

const stamp=(s:string|undefined)=>s?new Date(s).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'尚未取得';
const number=(x:number|null|undefined,suffix='%')=>x==null?'缺資料':`${x.toFixed(1)}${suffix}`;
const name=(r:StatRow)=>r.teamId?teamZh({id:r.teamId}):r.name;
function StatTable({snapshot,kind}:{snapshot:Snapshot|null;kind:Kind}){
  const [query,setQuery]=useState('');
  const pitching=kind!=='batter-team';
  const rows=useMemo(()=>[...(snapshot?.rows||[])].filter(r=>`${name(r)} ${r.name}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>{if(a.barrelPa===null)return 1;if(b.barrelPa===null)return -1;return pitching?a.barrelPa-b.barrelPa:b.barrelPa-a.barrelPa;}),[snapshot,query,pitching]);
  return <><Input aria-label="搜尋投手或球隊" placeholder="搜尋投手原名或球隊中文名稱" value={query} onChange={e=>setQuery(e.target.value)} className="my-3 max-w-md"/>
    <p className="mb-3 text-sm text-slate-400">{snapshot?.year||'本'}年球季・官方合格門檻・{rows.length} 筆・{pitching?'被優質擊球／打席由低至高':'優質擊球／打席由高至低'}。空值不當作零。</p>
    <div className="max-h-96 overflow-auto"><Table><TableHeader><TableRow><TableHead>名稱</TableHead><TableHead>擊球事件數</TableHead><TableHead>{pitching?'被擊球初速':'擊球初速'}（英里／時）</TableHead><TableHead>{pitching?'被強勁擊球率':'強勁擊球率'}</TableHead><TableHead>{pitching?'被優質擊球／擊球事件':'優質擊球／擊球事件'}</TableHead><TableHead>{pitching?'被優質擊球／打席':'優質擊球／打席'}</TableHead></TableRow></TableHeader>
    <TableBody>{rows.map(r=><TableRow key={r.id}><TableCell className="font-bold whitespace-nowrap">{name(r)}</TableCell><TableCell>{r.attempts}</TableCell><TableCell>{number(r.ev,'')}</TableCell><TableCell>{number(r.hardHit)}</TableCell><TableCell>{number(r.barrel)}</TableCell><TableCell className="text-[#ffd538]">{number(r.barrelPa)}</TableCell></TableRow>)}</TableBody></Table></div>
    {!rows.length&&<p className="py-5 text-slate-400">{snapshot?'沒有符合的資料':'等待來源回應，尚無資料。'}</p>}
  </>;
}
export default function Pregame(){
  const [evaluation,setEvaluation]=useState<any>(null);
  const updateResults=useCallback((value:any)=>setEvaluation(value),[]);
  const [analysis,setAnalysis]=useState<Record<number,AnalysisState>>({});
  const updateAnalysis=useCallback((id:number,value:AnalysisState)=>setAnalysis(old=>({...old,[id]:value})),[]);
  const primaryOdds=useSource<SuperSnapshot>('member-odds',60000);
  const runs=useSource<RunSnapshot>('runs',20*60000);
  const pitchers=useSource<Snapshot>('pitcher',20*60000),batting=useSource<Snapshot>('batter-team',20*60000),pitching=useSource<Snapshot>('pitcher-team',20*60000),schedule=useSource<Schedule>('schedule',30000);
  const [now,setNow]=useState(Date.now()),[dateMode,setDateMode]=useState('auto'),[count,setCount]=useState(3),[legs,setLegs]=useState<Leg[]>([]),[notice,setNotice]=useState('');
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer);},[]);
  const today=taipeiDay(now);
  const nextGame=(schedule.data?.games||[]).filter(g=>isPregame(g,now)).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0];
  const autoDay=nextGame?taipeiDay(nextGame.date):today;
  const day=dateMode==='auto'||dateMode<today?autoDay:dateMode;
  const dateOptions=Array.from({length:8},(_,i)=>shiftDay(today,i));
  const previousDay=useRef(day);
  useEffect(()=>{
    if(previousDay.current!==day){setLegs([]);setNotice('日期已更新，請重新選擇組合。');previousDay.current=day;}
  },[day]);
  useEffect(()=>{
    setDateMode('auto');
    void schedule.refresh();
  },[today,schedule.refresh]);
  useEffect(()=>{
    const resume=()=>{if(document.visibilityState==='visible'){setNow(Date.now());void schedule.refresh();}};
    document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);
    return()=>{document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);};
  },[schedule.refresh]);
  const datePicker=<Select value={dateMode<today&&dateMode!=='auto'?'auto':dateMode} onValueChange={v=>{setDateMode(v);setLegs([]);setNotice('切換日期已清空組合。');}}><SelectTrigger aria-label="選擇台灣賽事日期"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="auto">自動・{autoDay}（台灣）</SelectItem>{dateOptions.map(d=><SelectItem key={d} value={d}>{d}（台灣）</SelectItem>)}</SelectContent></Select>;
  const odds={...primaryOdds,data:superOdds(primaryOdds.data,schedule.data?.games||[],teamZh)};
  const selectedGames=(schedule.data?.games||[]).filter(g=>taipeiDay(g.date)===day).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  const scheduleOK=!schedule.error&&fresh(schedule.data?.fetchedAt,now,120000);
  const sources=[{title:'個別投手',kind:'pitcher' as Kind,...pitchers},{title:'團隊打擊',kind:'batter-team' as Kind,...batting},{title:'團隊投球',kind:'pitcher-team' as Kind,...pitching}];
  const statsOK=sources.every(s=>!s.error&&fresh(s.data?.fetchedAt,now,25*60000));
  const statsFor=(g:Match)=>({ab:batting.data?.rows.find(r=>r.teamId===g.away.id),hb:batting.data?.rows.find(r=>r.teamId===g.home.id),ap:pitching.data?.rows.find(r=>r.teamId===g.away.id),hp:pitching.data?.rows.find(r=>r.teamId===g.home.id),as:pitchers.data?.rows.find(r=>r.id===String(g.away.pitcherId)),hs:pitchers.data?.rows.find(r=>r.id===String(g.home.pitcherId))});
  function unavailable(g:Match){
    if(!scheduleOK)return '賽程資料尚未取得或已過期';
    if(!isPregame(g,now))return '已到開賽時間、賽事狀態不符或非例行賽';
    if(baseProbability(g)===null)return '戰績不足 20 場或資料缺漏';
    if(!statsOK)return '投打來源未齊或更新失敗';
    if(sources.some(s=>s.data?.year!==g.season))return '資料球季不一致';
    const s=statsFor(g);
    if(![s.ab,s.hb,s.ap,s.hp,s.as,s.hs].every(r=>r&&r.attempts>=50&&r.barrelPa!==null&&r.hardHit!==null))return '先發未公布、未達門檻或缺少投打資料';
    return '';
  }
  const eligible=selectedGames.filter(g=>!unavailable(g));
  const chosen=legs.map(leg=>({leg,g: (schedule.data?.games||[]).find(g=>g.id===leg.gameId)}));
  const allValid=chosen.length===count&&chosen.every(x=>x.g&&!unavailable(x.g));
  const combined=allValid?chosen.reduce((p,x)=>{const h=baseProbability(x.g!)!;return p*(x.leg.side==='home'?h:1-h);},1):null;
  function choose(g:Match,side:'away'|'home'){
    const reason=unavailable(g);if(reason){setNotice(reason);return;}
    if(legs.some(l=>l.gameId===g.id&&l.side===side)){setLegs(legs.filter(l=>l.gameId!==g.id));return;}
    const rest=legs.filter(l=>l.gameId!==g.id);
    if(rest.length>=count){setNotice(`最多選 ${count} 場，請先移除一場。`);return;}
    if(rest.some(l=>{const other=schedule.data?.games.find(x=>x.id===l.gameId);return other&&[other.home.id,other.away.id].some(id=>id===g.home.id||id===g.away.id);})){setNotice('為避免同隊雙重賽的關聯，同一隊只可出現在一個關卡。');return;}
    setLegs([...rest,{gameId:g.id,side}]);setNotice('');
  }
  function recommend(){const next=suggest(eligible,count);setLegs(next);setNotice(next.length<count?`只有 ${next.length} 場符合條件，不勉強湊滿 ${count} 關。`:'已按基礎估算較高的一方排序；你可以逐場換隊。');}
  return <section className="mb-6 space-y-5" aria-label="賽前分析與自選串關">
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={()=>{sources.forEach(s=>void s.refresh());void runs.refresh();}} disabled={sources.some(s=>s.loading)||runs.loading}><RefreshCw className={sources.some(s=>s.loading)||runs.loading?'animate-spin':''}/>更新投打數據</Button>

      {datePicker}
    </div>
    <GameContext games={selectedGames} onChange={updateAnalysis} onResults={updateResults}/>
    <Markets analysis={analysis} key={day} games={selectedGames} now={now} data={runs.data} error={runs.error} scheduleOK={scheduleOK} odds={odds.data} oddsError={odds.error} oddsLoading={odds.loading} refreshOdds={odds.refresh}/>
    <details open className="panel p-4"><summary className="cursor-pointer font-bold">查看勝負勝率與勝負串關</summary><div className="mt-4">
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold">每日對戰・賽前勝率暫估</h3><p className="text-xs text-slate-400">賽程抓取：{stamp(schedule.data?.fetchedAt)}（台灣）</p></div>{datePicker}</div>
        {schedule.error&&<p role="alert" className="text-rose-300">{schedule.error} 暫停串關計算。</p>}
        {schedule.loading&&!schedule.data&&<p role="status">正在取得賽程，尚無比分或勝率。</p>}
        {!schedule.loading&&!schedule.error&&!selectedGames.length&&<p className="panel p-5 text-slate-400">這個台灣日期沒有賽事，請切換日期。</p>}
        {selectedGames.map(g=>{const s=statsFor(g),h=baseProbability(g),reason=unavailable(g),pre=isPregame(g,now),show=pre&&scheduleOK&&h!==null;
          return <article key={g.id} className="panel overflow-hidden"><div className="flex flex-wrap justify-between gap-2 border-b border-white/10 p-4 text-sm"><span>{stamp(g.date)}（台灣）</span><span className="text-amber-200">{pre?'未開賽・勝率暫估':g.state==='Final'?'已完賽・不提供回填預測':g.state==='Live'?'進行中・不再提供賽前選擇':'賽事狀態待確認／已到開賽時間'}</span></div>
          <div className="grid grid-cols-2 gap-3 p-4">{(['away','home'] as const).map(side=>{const team=g[side],prob=show?(side==='home'?h!:1-h!):null;const active=legs.some(l=>l.gameId===g.id&&l.side===side);return <div key={side}><p className="text-sm text-slate-400">{side==='home'?'主隊':'客隊'}・{team.wins??'—'} 勝 {team.losses??'—'} 敗</p><h4 className="my-2 font-bold">{teamZh(team)}</h4><p className="text-2xl font-black text-[#ffd538]">{prob===null?'待分析':`${Math.round(prob*100)}%`}</p><p className="my-2 text-sm text-slate-400">預計先發：{team.pitcherName}</p><Button aria-pressed={active} variant={active?'default':'outline'} disabled={!!reason} onClick={()=>choose(g,side)} className="w-full">{active?'已加入・點擊移除':'選這隊勝'}</Button></div>;})}</div>
          {reason&&<p className="px-4 pb-3 text-sm text-amber-200">不可加入串關：{reason}</p>}
          <details className="border-t border-white/10 p-4 text-sm"><summary className="cursor-pointer font-bold">查看投打對照與估算依據</summary><p className="my-3 text-slate-400">下列都是本季累計資料，非今日打線；投球被擊球率通常越低越佳。比較不等於勝率加權。</p><Table><TableHeader><TableRow><TableHead>指標</TableHead><TableHead>客隊</TableHead><TableHead>主隊</TableHead></TableRow></TableHeader><TableBody>{[
            ['團隊強勁擊球率',s.ab?.hardHit,s.hb?.hardHit],['團隊優質擊球／打席',s.ab?.barrelPa,s.hb?.barrelPa],['團隊被優質擊球／打席',s.ap?.barrelPa,s.hp?.barrelPa],['先發被強勁擊球率',s.as?.hardHit,s.hs?.hardHit],['先發被優質擊球／打席',s.as?.barrelPa,s.hs?.barrelPa]
          ].map(([title,a,b])=><TableRow key={String(title)}><TableCell>{title}</TableCell><TableCell>{number(a as number|undefined)}</TableCell><TableCell>{number(b as number|undefined)}</TableCell></TableRow>)}</TableBody></Table><p className="mt-3 text-slate-400">勝率只使用雙方戰績；戰績接近時估算也接近五成。先發與投打指標用於供你檢查對戰差異。開賽後不使用賽後資料回填勝率。</p></details>
          </article>;})}
      </div>
      <aside className="panel space-y-4 p-5 xl:sticky xl:top-24"><h3 className="flex items-center gap-2 text-lg font-black"><Layers className="size-5 text-[#ffd538]"/>自選串關組合</h3><label className="block text-sm text-slate-400">關卡數量</label><Select value={String(count)} onValueChange={v=>{const n=Number(v);setCount(n);setLegs(l=>l.slice(0,n));setNotice('關卡數量已更新。');}}><SelectTrigger aria-label="選擇串關數量" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{[3,4,5].map(n=><SelectItem key={n} value={String(n)}>{n} 關</SelectItem>)}</SelectContent></Select>
        <Button className="w-full" onClick={recommend} disabled={!scheduleOK||!statsOK}>按基礎勝率推薦 {count} 關</Button>
        <div aria-live="polite" className="text-sm text-amber-200">{notice}</div>
        <p className="font-bold">已選 {legs.length}／{count} 關</p>
        {chosen.map(({leg,g})=><div key={leg.gameId} className="rounded-lg border border-white/10 p-3"><div className="flex justify-between gap-2"><span className="font-bold">{g?teamZh(g[leg.side]):'賽事資料已失效'} 勝</span><button aria-label="移除此關" className="text-sm underline" onClick={()=>setLegs(l=>l.filter(x=>x.gameId!==leg.gameId))}>移除</button></div>{g&&<p className="mt-1 text-xs text-slate-400">{teamZh(g.away)} 對 {teamZh(g.home)}</p>}<p className="mt-1 text-sm text-amber-200">{g?unavailable(g)||`基礎暫估 ${Math.round((leg.side==='home'?baseProbability(g)!:1-baseProbability(g)!)*100)}%`:'資料缺漏，請重新選擇'}</p></div>)}
        <div className="rounded-xl bg-[#ffd538]/10 p-4"><p className="text-sm">全數選中機率・獨立假設試算</p><p className="my-2 text-3xl font-black text-[#ffd538]">{combined===null?'—':`${(combined*100).toFixed(1)}%`}</p><p className="text-sm text-slate-400">{combined===null?'選滿有效關卡後才計算。':'將未校準的單場機率相乘，並非真實命中率。'} 各場可能相關，關數增加通常更難全中。</p></div>
        <Button variant="outline" className="w-full" onClick={()=>{setLegs([]);setNotice('已清空組合。');}} disabled={!legs.length}>清空組合</Button>

      </aside>
    </div>

    </div></details>
  </section>;
}
