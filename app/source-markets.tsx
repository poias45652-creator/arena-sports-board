'use client';
import {useState} from 'react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Button} from '@/components/ui/button';
import {fresh} from '@/lib/baseball';
import type {SuperSnapshot} from '@/lib/super007';
import type {HrDisplayMarket,HrDisplayQuote} from '@/lib/hr9988';

const periods=[{id:'full',label:'全場'},{id:'firstHalf',label:'上半場'}] as const;
const types=[{id:103,label:'讓分'},{id:104,label:'大小'},{id:111,label:'獨贏'}];
const text=(v:unknown)=>v===null||v===undefined||v===''?'—':String(v);
const teamName=(s:string)=>s.replace(/\(主\)|（主）/g,'');

function Quote({quote:q,type}:{quote:HrDisplayQuote;type:number}){
 return <div className="space-y-2 border-t border-white/10 py-3 text-sm">
  <p className={q.open?'text-slate-400':'text-amber-200'}>{q.primary?'主盤':'其他盤'}{!q.open?'・封盤／暫停':''}</p>
  {!q.open?<p className="text-slate-400">暫不顯示盤口與賠率</p>:type===104?<>
   <p className="text-base font-bold">大小 {text(q.total)}</p>
   <p className="tabular-nums">大 @{text(q.over)} ／ 小 @{text(q.under)}</p>
  </>:<>
   {type===103&&<p className="text-base font-bold">{q.homeLine!==''?`主讓 ${q.homeLine}`:q.awayLine!==''?`客讓 ${q.awayLine}`:'盤口未提供'}</p>}
   <p className="tabular-nums">主 @{text(q.homePrice)} ／ 客 @{text(q.awayPrice)}</p>
  </>}
 </div>;
}

export default function SourceMarkets({data,error,loading,refresh,now,day}:{data:SuperSnapshot|null;error:string;loading:boolean;refresh:()=>Promise<void>;now:number;day:string}){
 const [period,setPeriod]=useState('full');
 const valid=!error&&fresh(data?.fetchedAt,now,150000);
 const games=valid?(data?.games||[]).filter(g=>g.live===false&&g.start?.slice(0,10).replaceAll('/','-')===day&&Date.parse(g.start.replaceAll('/','-').replace(' ','T')+'+08:00')>now):[];
 return <section className="panel space-y-4 p-4 sm:p-5" aria-label="MLB 原始盤口展示">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h3 className="text-xl font-black">MLB 盤口</h3><p className="mt-1 text-sm text-slate-400">{day}（台灣）・{data?.source==='hr9988'?'SUPER':data?.source||'SUPER'}・賽前盤</p></div>
   <Button variant="outline" disabled={loading} onClick={()=>void refresh()}>{loading?'讀取中…':'更新盤口'}</Button>
  </div>
  <Tabs value={period} onValueChange={setPeriod}>
   <TabsList aria-label="盤口時段"><TabsTrigger value="full">全場</TabsTrigger><TabsTrigger value="firstHalf">上半場</TabsTrigger></TabsList>
   <p className="my-3 text-sm text-slate-400">來源原始盤口與賠率・僅供查看。上半場範圍及結算依來源規則。</p>
   <p className="mb-4 text-sm text-slate-400">{data?.fetchedAt?`最後取得：${new Date(data.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}（台灣）`:'尚未取得盤口'}・網頁開啟時每分鐘更新</p>
   {periods.map(p=><TabsContent key={p.id} value={p.id} className="space-y-4">
    {!valid?<p role="status" className="text-sm text-amber-200">{error||(loading?'正在讀取你的會員盤口…':'盤口尚未取得或已過期，請更新盤口。')}</p>:!games.length?<p role="status" className="text-sm text-slate-400">來源目前沒有此日期的 MLB 未開賽場次。</p>:games.map(g=>{
     const markets=(g.displayMarkets||[]) as HrDisplayMarket[];
     return <article key={g.id} className="rounded-lg border border-white/10 p-4">
      <p className="mb-2 text-sm text-slate-400">{g.start}（台灣）</p>
      <h4 className="text-base font-bold">{teamName(g.away)}（客）vs {teamName(g.home)}（主）</h4>
      {!g.displayMarkets?<p className="mt-3 text-sm text-amber-200">等待新版盤口資料，請稍後更新。</p>:<div className="mt-4 grid gap-4 md:grid-cols-3">
       {types.map(t=>{const rows=markets.filter(m=>m.period===p.id&&m.type===t.id).flatMap(m=>m.quotes);const primary=rows.filter(q=>q.primary),others=rows.filter(q=>!q.primary);
        return <div key={t.id} className="min-w-0 rounded-md bg-white/[0.03] p-3"><h5 className="mb-2 font-bold">{p.label}{t.label}</h5>
         {!rows.length?<p className="text-sm text-slate-400">來源未提供</p>:<>{primary.map((q,i)=><Quote key={`${q.id}-${i}`} quote={q} type={t.id}/>)}
          {others.length>0&&<details><summary className="cursor-pointer py-2 text-sm text-slate-300">查看其他盤（{others.length}）</summary>{others.map((q,i)=><Quote key={`${q.id}-${i}`} quote={q} type={t.id}/>)}</details>}
         </>}
        </div>;
       })}
      </div>}
     </article>;
    })}
   </TabsContent>)}
  </Tabs>
 </section>;
}
