"use client";
export default function Super007({data,error,now}:{data:any;error:string;now:number}){
 const stale=!data||now-Date.parse(data.fetchedAt)>150000;
 return <details open className="panel p-4"><summary className="cursor-pointer font-bold">Super007 資料</summary><div className="mt-3 space-y-3">
 <p className="text-sm text-slate-400">{data?`最後更新：${new Date(data.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}（台灣）`:'正在連接來源…'}</p>
 <p className="text-sm text-slate-400">原始數值與原始賠率；特殊結算尚未納入推薦。網頁開啟時每分鐘更新。</p>
 {error||stale?<p role="status">{error||'等待最新資料'}</p>:data.games.length?data.games.map((g:any)=><article key={g.id} className="border-t border-white/10 pt-3"><p className="font-bold">{g.away} vs {g.home}</p><p className="text-sm text-slate-400">來源開賽時間：{g.start}</p>{g.markets.map((m:any)=><div key={m.type} className="mt-2 text-sm"><strong>{m.type===103?'全場讓分':m.type===104?'全場大小':'全場獨贏'}</strong>{m.quotes.map((q:any)=><p key={q.id}>{m.type===104?`大小 ${q.total}｜大 ${q.over}／小 ${q.under}`:m.type===103?`主 ${q.homeLine||'—'}／客 ${q.awayLine||'—'}｜主賠率 ${q.homePrice}／客賠率 ${q.awayPrice}`:`主 ${q.homePrice}／客 ${q.awayPrice}`}</p>)}</div>)}</article>):<p>來源目前沒有 MLB 資料。</p>}
 </div></details>;
}
