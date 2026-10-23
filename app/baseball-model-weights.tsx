'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {SlidersHorizontal,X} from 'lucide-react';
import {baseballTeamSettings} from '@/lib/team-model-settings';
import {useTeamWeightBook,TeamWeightNotice} from './team-weight-book';
import {BASEBALL_FACTOR_LABELS,BASEBALL_MODEL_NAMES,baseballSettingsKey,customBaseballSettings,defaultBaseballSettings,parseBaseballSettings,rebalanceBaseballWeight,type BaseballModelSettings,type BaseballModelFamily,type BaseballModelLeague} from '@/lib/baseball-model-settings';
export function useBaseballModelSettings(league:BaseballModelLeague){
 const teamBook=useTeamWeightBook(league);
 const [saved,setSaved]=useState<{league:BaseballModelLeague;settings:BaseballModelSettings}>({league,settings:defaultBaseballSettings()}),[notice,setNotice]=useState('');
 useEffect(()=>{try{setSaved({league,settings:parseBaseballSettings(localStorage.getItem(baseballSettingsKey(league)))||defaultBaseballSettings()});}catch{setSaved({league,settings:defaultBaseballSettings()});}setNotice('');},[league]);
 const settings=baseballTeamSettings(saved.league===league?saved.settings:defaultBaseballSettings(),teamBook.book);
 function apply(value:BaseballModelSettings){const {teams:_,...base}=value;const next=parseBaseballSettings(base);if(!next)return;setSaved({league,settings:next});try{localStorage.setItem(baseballSettingsKey(league),JSON.stringify(next));setNotice('模型比例已套用，未開賽的分析已重新計算。');}catch{setNotice('模型比例已套用；瀏覽器無法儲存，重新整理後會回到預設。');}}
 return {settings,apply,notice,teamNotice:<TeamWeightNotice count={teamBook.count} onClear={teamBook.clear}/>};
}
export default function BaseballModelWeights({league,settings,onApply}:{league:BaseballModelLeague;settings:BaseballModelSettings;onApply:(s:BaseballModelSettings)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
 const [draft,setDraft]=useState(settings),[tab,setTab]=useState<BaseballModelFamily>('multifactor');
 const close=()=>{dialog.current?.close();trigger.current?.focus();};
 const weights=draft.weights[tab];
 return <><button ref={trigger} type="button" className="baseball-model-trigger" aria-haspopup="dialog" onClick={()=>{setDraft(structuredClone(settings));setTab(settings.moneyline);dialog.current?.showModal();}}><SlidersHorizontal size={20}/>模型比例{customBaseballSettings(settings)&&<small>自訂</small>}</button>
 <dialog ref={dialog} className="baseball-model-dialog" aria-labelledby={id+'-title'} onCancel={close}><form onSubmit={e=>{e.preventDefault();onApply(draft);close();}}>
  <header><h2 id={id+'-title'}>棒球模型比例</h2><button type="button" aria-label="關閉棒球模型比例" onClick={close}><X size={22}/></button></header>
  <div className="baseball-model-body"><p>快速選擇模型預設比例；比例合計為 100%。未使用的欄位可設為 0，缺少實測資料的因子保持中性。</p>
  <h3>目前聯盟玩法套用模型 <small>{league}</small></h3>
  {([['moneyline','全場獨贏'],['fullGamePk','全場零讓分']] as const).map(([key,label])=><label className="baseball-model-select" key={key}><span>{label}</span><select aria-label={label+'套用模型'} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value as BaseballModelFamily})}>{Object.entries(BASEBALL_MODEL_NAMES).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>)}
  <div className="baseball-model-tabs" role="group" aria-label="棒球模型種類">{Object.entries(BASEBALL_MODEL_NAMES).map(([key,name])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>setTab(key as BaseballModelFamily)}>{tab===key?'✓　':''}{name}</button>)}</div>
  <div className="baseball-model-sliders">{Object.entries(weights).map(([key,value])=><label htmlFor={id+'-'+key} key={key}><span>{BASEBALL_FACTOR_LABELS[key as keyof typeof BASEBALL_FACTOR_LABELS]}<output>{value.toFixed(1)}%</output></span><input id={id+'-'+key} type="range" min="0" max="100" step="0.1" value={value} aria-valuetext={value.toFixed(1)+'%'} style={{background:`linear-gradient(to right,#ffdb35 ${value}%,#8d9eb2 ${value}%)`}} onChange={e=>setDraft({...draft,weights:{...draft.weights,[tab]:rebalanceBaseballWeight(weights,key as keyof typeof weights,Number(e.target.value))}})}/></label>)}</div>
  </div>
  <footer><button type="button" className="baseball-model-reset" onClick={()=>setDraft({...draft,weights:{...draft.weights,[tab]:defaultBaseballSettings().weights[tab]}})}>還原此模型預設</button><button type="button" onClick={close}>取消</button><button type="submit" className="baseball-model-apply">套用</button></footer>
 </form></dialog></>;
}
