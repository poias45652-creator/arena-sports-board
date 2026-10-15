'use client';
import {useId,useRef,useState} from 'react';
import {SlidersHorizontal,X} from 'lucide-react';
import {normalizedWeights,type Weights} from '@/lib/basketball-efficiency';
import {defaultNbaWeights,isDefaultNbaWeights,NBA_WEIGHT_LABELS} from '@/lib/nba-model-weights';

export default function NbaModelWeights({weights,onApply,league='NBA'}:{league?:'NBA'|'WNBA';weights:Weights;onApply:(weights:Weights)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
 const [draft,setDraft]=useState<Weights>([...weights]);
 const hasWeight=draft.some(v=>v>0),percentages=hasWeight?normalizedWeights(draft):[0,0,0,0,0];
 function close(){dialog.current?.close();trigger.current?.focus();}
 return <>
  <button ref={trigger} type="button" className="nba-model-trigger" aria-haspopup="dialog" onClick={()=>{setDraft([...weights]);dialog.current?.showModal();}}><SlidersHorizontal size={17}/><span>模型比例</span>{!isDefaultNbaWeights(weights)&&<small>自訂</small>}</button>
  <dialog ref={dialog} className="nba-model-dialog" aria-labelledby={id+'-title'} aria-describedby={id+'-description'} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}}>
   <form onSubmit={e=>{e.preventDefault();if(hasWeight){onApply([...draft]);close();}}}>
    <header><h2 id={id+'-title'}>{league} 籃球模型比例</h2><button type="button" className="nba-model-close" aria-label="關閉模型比例" onClick={close}><X size={20}/></button></header>
    <p id={id+'-description'}>調整五項效率指標的比重，按「套用」重新計算賽前分析。</p>
    <div className="nba-model-context">球員情境<span>沿用現役陣容與傷停資料</span></div>
    <p className="nba-model-hint">比例依總和換算為 100%；球員上場時間與傷停判定維持原設定。</p>
    <div className="nba-model-sliders">{NBA_WEIGHT_LABELS.map((label,i)=><label key={label} htmlFor={id+'-'+i}><span>{label}<output htmlFor={id+'-'+i}>{(percentages[i]*100).toFixed(1)}%</output></span><input id={id+'-'+i} type="range" min="0" max="100" step="1" value={draft[i]} aria-valuetext={`${(percentages[i]*100).toFixed(1)}%`} style={{background:`linear-gradient(to right,#ffda37 ${draft[i]}%,#91a1b6 ${draft[i]}%)`}} onChange={e=>{const next=[...draft] as Weights;next[i]=Number(e.target.value);setDraft(next);}}/></label>)}</div>
    {!hasWeight&&<p className="nba-model-error" role="alert">至少保留一項大於 0 的權重。</p>}
    <p className="nba-model-storage">設定保存在這個瀏覽器。</p>
    <footer><button type="button" className="nba-model-reset" onClick={()=>setDraft(defaultNbaWeights())}>還原預設比例</button><button type="button" onClick={close}>取消</button><button className="nba-model-apply" type="submit" disabled={!hasWeight}>套用</button></footer>
   </form>
  </dialog>
 </>;
}
