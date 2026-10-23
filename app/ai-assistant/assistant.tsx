'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUp,Bot,CalendarDays,Check,LoaderCircle,RefreshCw,SlidersHorizontal,Sparkles} from 'lucide-react';
import SessionAccount from '../session-account';
import {AI_ACTIONS,AI_INSUFFICIENT,AI_PAST_DAYS,AI_FUTURE_DAYS,aiDay,validAiDay,type AiMatch,type AiSuggestion,type AiAction} from '@/lib/ai-assistant';
import {baseballSettingsKey,defaultBaseballSettings,parseBaseballSettings,baseballSettingsForGame} from '@/lib/baseball-model-settings';
import {basketballWeightStorageKey,readNbaWeights} from '@/lib/nba-model-weights';
import {defaultFootballSettings,footballSettingsKey,parseFootballSettings} from '@/lib/football-model-weights';
import {readTeamWeightBook,teamWeightStorageKey,saveTeamWeightProfiles,footballFixtureSettings,basketballTeamWeights,baseballTeamSettings} from '@/lib/team-model-settings';
type Message={role:'user'|'assistant';text:string;suggestion?:AiSuggestion;at?:string};
const stamp=(s:string)=>new Date(s).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
function currentSettings(match:AiMatch){
 const {league}=match,home=match.homeId||'',away=match.awayId||'';
 try{
  const book=readTeamWeightBook(localStorage.getItem(teamWeightStorageKey(league)),league);
  if(league==='MLB'||league==='NPB')return baseballSettingsForGame(baseballTeamSettings(parseBaseballSettings(localStorage.getItem(baseballSettingsKey(league)))||defaultBaseballSettings(),book),home,away);
  if(league==='NBA'||league==='WNBA')return basketballTeamWeights(readNbaWeights(localStorage.getItem(basketballWeightStorageKey(league))),book,home,away);
  return footballFixtureSettings(localStorage,league,{id:match.id,start:match.start,homeId:home,awayId:away},parseFootballSettings(localStorage.getItem(footballSettingsKey(league)))||defaultFootballSettings(),book);
 }catch{return undefined;}
}
export default function AiAssistant(){
 const [league,setLeague]=useState('MLB'),[day,setDay]=useState(aiDay),[leagues,setLeagues]=useState<{code:string;name:string}[]>([]);
 const [initialized,setInitialized]=useState(false),[aiEnabled,setAiEnabled]=useState(false),[matches,setMatches]=useState<AiMatch[]>([]),[gameId,setGameId]=useState('');
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[question,setQuestion]=useState(''),[revision,setRevision]=useState(0),[messages,setMessages]=useState<Message[]>([]);
 const [nextBusy,setNextBusy]=useState(false),[nextNotice,setNextNotice]=useState('');
 const nextPending=useRef<AbortController|null>(null),found=useRef<{league:string;day:string;matches:AiMatch[]}|null>(null);
 const pending=useRef<AbortController|null>(null),log=useRef<HTMLDivElement>(null),locked=useRef(false);
 const selected=matches.find(g=>g.id===gameId);
 useEffect(()=>{
  const p=new URLSearchParams(location.search);setLeague(p.get('competition')||(p.get('league')==='FOOTBALL'?'eng.1':p.get('league'))||'MLB');
  if(validAiDay(p.get('date')))setDay(p.get('date')!);
  const controller=new AbortController();
  fetch('/api/ai-assistant?kind=status',{cache:'no-store',signal:controller.signal}).then(async r=>{if(r.status===401){location.assign('/login');return;}const data=await r.json();if(!r.ok)throw Error(data.error);setLeagues(data.leagues);setAiEnabled(data.aiEnabled);setLeague(old=>data.leagues.some((l:any)=>l.code===old)?old:'MLB');setInitialized(true);}).catch(e=>{if(!controller.signal.aborted)setNotice(e.message||'助手暫時無法連線');});
  return()=>{controller.abort();pending.current?.abort();nextPending.current?.abort();};
 },[]);
 useEffect(()=>{
  if(!initialized)return;
  cancelNext();pending.current?.abort();locked.current=false;setBusy(false);setMessages([]);setQuestion('');setMatches([]);setGameId('');setNotice('');setLoading(true);
  const cached=found.current;found.current=null;
  if(cached?.league===league&&cached.day===day){setMatches(cached.matches);setGameId(cached.matches[0]?.id||'');setLoading(false);return;}
  const controller=new AbortController();
  fetch(`/api/ai-assistant?league=${encodeURIComponent(league)}&date=${day}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])}).then(async r=>{if(r.status===401){location.assign('/login');return;}const data=await r.json();if(!r.ok)throw Error(data.error);if(!controller.signal.aborted){setMatches(data.matches);setGameId(data.matches[0]?.id||'');}}).catch(e=>{if(!controller.signal.aborted)setNotice(e.name==='TimeoutError'?AI_INSUFFICIENT:e.message||AI_INSUFFICIENT);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[league,day,initialized,revision]);
 useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[messages,busy]);
 function cancelNext(){nextPending.current?.abort();nextPending.current=null;setNextBusy(false);setNextNotice('');}
 async function nextMatch(){
  if(!initialized||loading||nextPending.current)return;
  const controller=new AbortController();nextPending.current=controller;setNextBusy(true);setNextNotice('');
  try{
   const response=await fetch(`/api/ai-assistant?kind=next&league=${encodeURIComponent(league)}&date=${day}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])});
   if(response.status===401){location.assign('/login');return;}
   const data=await response.json();if(!response.ok)throw Error(data.error);
   if(controller.signal.aborted)return;
   if(data.day===null){setNextNotice('來源尚未提供近期的下一個比賽日，可自行選擇日期。');return;}
   if(!validAiDay(data.day)||data.day<=day||!Array.isArray(data.matches)||!data.matches.length||data.matches.some((g:AiMatch)=>g.league!==league||g.day!==data.day))throw Error('Invalid fixtures');
   found.current={league,day:data.day,matches:data.matches};setDay(data.day);
  }catch(e){if(!controller.signal.aborted)setNextNotice('下一個比賽日暫時無法取得，請稍後再試。');}
  finally{if(nextPending.current===controller){nextPending.current=null;setNextBusy(false);}}
 }
 function selectGame(id:string){cancelNext();pending.current?.abort();locked.current=false;setBusy(false);setGameId(id);setMessages([]);setNotice('');setQuestion('');}
 async function ask(action?:AiAction){
  if(locked.current||!selected||(!action&&!question.trim()))return;
  const text=action?AI_ACTIONS[action]:question.trim(),controller=new AbortController();pending.current=controller;locked.current=true;setBusy(true);setNotice('');setQuestion('');
  const history=messages.filter(m=>m.role==='user').slice(-4).map(m=>m.text);
  setMessages(old=>[...old,{role:'user' as const,text}].slice(-30));
  try{
   const response=await fetch('/api/ai-assistant',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]),body:JSON.stringify({league,day,gameId,settings:currentSettings(selected),...(action?{action}:{question:text,history})})});
   if(response.status===401){location.assign('/login');return;}
   const data=await response.json();if(!response.ok)throw Error(data.error||'助手暫時無法連線');
   if(!controller.signal.aborted)setMessages(old=>[...old,{role:'assistant',text:data.answer,suggestion:data.suggestion,at:data.answer===AI_INSUFFICIENT?undefined:data.capturedAt}]);
  }catch(e){if(!controller.signal.aborted)setNotice(e instanceof Error&&e.name!=='TimeoutError'?e.message:'回覆逾時，請稍後重試。');}
  finally{if(pending.current===controller){locked.current=false;setBusy(false);}}
 }
 function applySuggestion(s:AiSuggestion){
  try{if(s.teams?.length){saveTeamWeightProfiles(localStorage,league,s.teams.map(t=>({teamId:t.teamId,teamName:t.teamName,league,value:t.value,updatedAt:Date.now()})));}else{localStorage.setItem(s.storageKey,JSON.stringify(s.value));}location.assign(s.href);}catch{setNotice('瀏覽器無法儲存權重，請至賽事頁手動套用。');}
 }
 return <main className="arena-shell xz-theme xz-assistant-page">
  <header className="xz-assistant-nav"><a href="/" className="header-action"><ArrowLeft size={17}/>返回賽事</a><a href="/" className="xz-assistant-brand"><img src="/brand/xingzhun-icon-192-v1.png" alt="" width={36} height={36}/><b>星準</b></a><SessionAccount/></header>
  <div className="xz-assistant-heading"><div><p>會員專屬 · 賽事解讀</p><h1><Sparkles aria-hidden="true"/>AI星準助手</h1></div><span><i/>依星準分析回答</span></div>
  <div className="xz-assistant-workspace">
   <aside className="xz-assistant-selector"><h2>選擇要詢問的場次</h2><p>先選比賽，再問分析與權重。</p>
    <label>聯賽<select value={league} onChange={e=>{cancelNext();setLeague(e.target.value);}} disabled={!initialized}>{leagues.length?leagues.map(l=><option key={l.code} value={l.code}>{l.name}</option>):<option value="MLB">讀取中…</option>}</select></label>
    <label>比賽日期（台灣）<input type="date" value={day} min={aiDay(Date.now()-AI_PAST_DAYS*86400000)} max={aiDay(Date.now()+AI_FUTURE_DAYS*86400000)} onChange={e=>{if(e.target.value){cancelNext();setDay(e.target.value);}}}/></label>
    <div className="xz-assistant-list-title"><b>星準場次</b><button type="button" aria-label="重新讀取場次" disabled={loading} onClick={()=>{cancelNext();setRevision(v=>v+1);}}><RefreshCw size={16} className={loading?'animate-spin':''}/></button></div>
    <div className={`xz-assistant-matches${!loading&&!matches.length?' is-empty':''}`} aria-busy={loading}>{loading?<p>正在取得場次…</p>:matches.length?matches.map(g=><button type="button" key={g.id} aria-pressed={g.id===gameId} onClick={()=>selectGame(g.id)}><small>{stamp(g.start)}</small><span>{g.away}</span><span>對 {g.home}</span>{g.id===gameId&&<Check size={16}/>}</button>):<div className="xz-assistant-empty"><CalendarDays size={26}/><p>{notice||`${day} 沒有${leagues.find(l=>l.code===league)?.name||league}場次`}</p>{!notice&&<small>可查看下一個比賽日，或自行選擇日期。</small>}</div>}</div>
    <div className="xz-assistant-next"><button type="button" aria-busy={nextBusy} aria-describedby={nextNotice?'assistant-next-status':undefined} disabled={!initialized||loading||nextBusy} onClick={()=>void nextMatch()}><span className="xz-next-symbol" aria-hidden="true">{nextBusy?<LoaderCircle size={19} className="animate-spin"/>:<CalendarDays size={19}/>}</span><span className="xz-next-label">{nextBusy?'正在查詢…':'下一個比賽日'}</span><ArrowRight size={18} className="xz-next-arrow" aria-hidden="true"/></button>{nextNotice&&<p id="assistant-next-status" role="status">{nextNotice}</p>}</div>
   </aside>
   <section className="xz-assistant-chat" aria-label="星準助手問答">
    <header><div className="xz-assistant-avatar"><Bot size={25}/></div><div><h2>{selected?`${selected.away} 對 ${selected.home}`:'AI星準助手'}</h2><p>{selected?`${stamp(selected.start)} · 台灣時間`:'請先從左側選擇場次'}</p></div></header>
    <div className="xz-assistant-log" ref={log} role="log" aria-live="polite" aria-relevant="additions">
     {!messages.length&&<div className="xz-assistant-welcome"><Sparkles size={30}/><h3>看懂這場，從一個問題開始。</h3><p>我可以解釋星準的分析原因，整理不利因素，並提供建議權重。</p></div>}
     {messages.map((m,i)=><article key={i} className={`xz-assistant-message ${m.role}`}><small>{m.role==='user'?'你':'星準助手'}</small><p>{m.text}</p>{m.suggestion&&<div className="xz-assistant-weight-card"><h3><SlidersHorizontal size={16}/>{m.suggestion.label}</h3>{m.suggestion.teams?.length?<><div className="xz-assistant-team-weights">{m.suggestion.teams.map(t=><section key={t.teamId}><h4>{t.teamName}</h4><div>{t.weights.map(w=><span key={w.name}>{w.name}<b>{w.value.toFixed(1)}%</b></span>)}</div><p>{t.reason}</p></section>)}</div><p className="xz-assistant-weight-method">各隊分別保存，未開賽對戰綜合雙方權重計算。已開賽場次保留原賽前分析。試算配置尚未經各隊獨立回測。</p></>:<div>{m.suggestion.weights.map(w=><span key={w.name}>{w.name}<b>{Number(w.value.toFixed(1))}%</b></span>)}</div>}<button type="button" onClick={()=>applySuggestion(m.suggestion!)}>{m.suggestion.teams?.length?(selected&&Date.parse(selected.start)<=Date.now()?'保存兩隊權重供後續賽事使用':'套用兩隊權重並返回分析'):'套用權重並返回分析'}</button></div>}{m.at&&<time>分析資料：{stamp(m.at)}</time>}</article>)}
     {busy&&<div className="xz-assistant-thinking"><LoaderCircle size={17} className="animate-spin"/>正在整理本場分析…</div>}
    </div>
    <div className="xz-assistant-compose"><div className="xz-assistant-quick">{Object.entries(AI_ACTIONS).map(([key,label])=><button key={key} type="button" disabled={!selected||busy||loading} onClick={()=>void ask(key as AiAction)}>{label}</button>)}</div>
     {notice&&<p className="xz-assistant-notice" role="alert">{notice}</p>}
     <form onSubmit={e=>{e.preventDefault();void ask();}}><label className="sr-only" htmlFor="assistant-question">詢問本場分析</label><textarea id="assistant-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={600} rows={2} disabled={!aiEnabled||busy||!selected} placeholder={aiEnabled?'例如：為什麼比較看好主隊？':'AI 自由提問尚未啟用，可先使用上方快捷分析。'} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void ask();}}}/><button type="submit" aria-label="送出問題" disabled={!aiEnabled||busy||!selected||!question.trim()}><ArrowUp size={21}/></button></form>
     <p className="xz-assistant-scope">僅回答所選星準場次的分析與權重。{question.length>0&&<span>{question.length}/600</span>}</p>
    </div>
   </section>
  </div>
 </main>;
}
