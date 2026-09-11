"use client";
import {useState} from 'react';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {parseSourceLine,netProfit,parlayReturn} from '@/lib/settlement';
import {scoreFraction} from '@/lib/markets';
export default function SettlementCalculator(){
 const [market,setMarket]=useState('spread'),[side,setSide]=useState('first'),[line,setLine]=useState('1+75'),[home,setHome]=useState('5'),[away,setAway]=useState('4'),[price,setPrice]=useState('0.95'),[stake,setStake]=useState('1000');
 const [legs,setLegs]=useState<{fraction:number;price:number}[]>([]);
 const parsed=parseSourceLine(line),h=Number(home),a=Number(away),odds=Number(price),amount=Number(stake),first=side==='first';
 const valid=[home,away,price,stake].every(v=>v.trim()!=='')&&[h,a,odds,amount].every(Number.isFinite)&&Number.isInteger(h)&&Number.isInteger(a)&&h>=0&&a>=0&&odds>0&&amount>=0;
 let fraction:number|null=null;
 if(valid){if(market==='void')fraction=0;else if(market==='moneyline')fraction=Math.sign(h-a)*(first?1:-1);else if(market==='parity')fraction=((h+a)%2===(first?1:0))?1:-1;else if(parsed)fraction=scoreFraction({home:h,away:a},{gameId:0,market:market==='total'?'total':'spread',side:market==='total'?(first?'over':'under'):(first?'home':'away'),line:parsed.line*(market==='spread'?-1:1),boundary:parsed.boundary,parts:parsed.parts?.map(n=>n*(market==='spread'?-1:1))});}
 const result=fraction===null?null:amount*netProfit(fraction,odds),combo=valid?parlayReturn(amount,legs):null;
 const options=market==='total'?['大分','小分']:market==='parity'?['單','雙']:['主隊','客隊'];
 return <details className="panel p-5"><summary className="cursor-pointer font-bold">盤口與串關結算試算</summary><p className="my-3 text-sm text-slate-400">依 Super007 盤口對照與棒球過關範例計算。輸入已確認有效的賽果；試算不會送出投注。讓分欄以主隊讓分為基準，賠率不含本金。</p>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <Select value={market} onValueChange={setMarket}><SelectTrigger aria-label="試算玩法"><SelectValue/></SelectTrigger><SelectContent>{[['spread','讓分'],['total','大小'],['moneyline','獨贏（和局退回）'],['parity','總分單雙'],['void','取消／退回']].map(([v,t])=><SelectItem value={v} key={v}>{t}</SelectItem>)}</SelectContent></Select>
 <Select value={side} onValueChange={setSide}><SelectTrigger aria-label="試算方向"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="first">{options[0]}</SelectItem><SelectItem value="second">{options[1]}</SelectItem></SelectContent></Select>
 <label className="text-sm">原始盤口<Input value={line} disabled={!['spread','total'].includes(market)} onChange={e=>setLine(e.target.value)} placeholder="1+75、7-55、0.5/1"/></label>
 <label className="text-sm">賠率（不含本金）<Input type="number" step="0.001" value={price} onChange={e=>setPrice(e.target.value)}/></label>
 <label className="text-sm">主隊得分<Input type="number" min="0" value={home} onChange={e=>setHome(e.target.value)}/></label>
 <label className="text-sm">客隊得分<Input type="number" min="0" value={away} onChange={e=>setAway(e.target.value)}/></label>
 <label className="text-sm">本金<Input type="number" min="0" value={stake} onChange={e=>setStake(e.target.value)}/></label>
 </div><p className="my-3" role="status">{fraction===null?'請輸入有效盤口、分數與金額。':`${fraction===0?'退回':fraction>0?'贏 '+(fraction*100).toFixed(0)+'%':'輸 '+(-fraction*100).toFixed(0)+'%'} · 淨損益 ${result!.toFixed(2)} · 含本金返還 ${(amount+result!).toFixed(2)}`}</p>
 <Button variant="outline" disabled={fraction===null||legs.length>=10} onClick={()=>fraction!==null&&setLegs([...legs,{fraction,price:odds}])}>加入串關試算</Button><p className="my-3 text-sm text-slate-400">每次加入須為不同賽事；此處是手動情境，不代表已選的推薦單。取消按倍數 1 計，中洞輸保留剩餘本金。棒球過關最高可贏額依官方規則為 200 萬，以下先顯示未套限額的公式結果。</p>
 {legs.map((l,i)=><p key={i} className="text-sm">第 {i+1} 關：{l.fraction===0?'退回':l.fraction>0?'贏':'輸'} {Math.abs(l.fraction*100).toFixed(0)}% · 賠率 {l.price}</p>)}
 {combo&&<p className="my-3 font-bold">串關返還 {combo.returned.toFixed(2)} · 淨損益 {combo.profit.toFixed(2)}{combo.profit>2000000?'（超出官方可贏上限）':''}</p>}
 {!!legs.length&&<Button variant="outline" onClick={()=>setLegs([])}>清空試算</Button>}
 <p className="mt-4 text-sm text-slate-400">有效局數、提前結束、滾球、特殊玩法與各運動規則須分別判定，不以全場棒球公式代算。<a className="underline" href="https://super007.net/#/rules/tw" target="_blank" rel="noreferrer">查看來源規則</a></p>
 </details>;
}
