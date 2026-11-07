'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {FRONT_VIEWS} from '@/lib/sport-navigation';
import {useSuperWorkspace} from './super-workspace';

type Picks={active:boolean;date:string;rows:{label:string;selected:boolean}[]};
export default function RegionalBasketballBoard({league,onViewChange}:{league:'NBL'|'KBL';onViewChange:(view:string)=>void}){
  const frame=useRef<HTMLIFrameElement>(null),pane=useId(),workspace=useSuperWorkspace();
  const [src]=useState(()=>'/regional-basketball/board'+window.location.search+window.location.hash);
  const [height,setHeight]=useState(640),[picks,setPicks]=useState<Picks>({active:false,date:'',rows:[]});
  useEffect(()=>{
    const send=(type:string)=>frame.current?.contentWindow?.postMessage({type,search:location.search,hash:location.hash},location.origin);
    const back=()=>send('basketball-history'),refresh=()=>send('basketball-refresh'),assistant=()=>send('basketball-assistant');
    const receive=(event:MessageEvent)=>{
      if(event.origin!==location.origin||event.source!==frame.current?.contentWindow||!event.data)return;
      const {type,search,height,rows}=event.data;
      if(type==='basketball-size'&&Number.isFinite(height))setHeight(Math.max(480,height));
      if(type==='basketball-scroll')frame.current?.scrollIntoView({block:'start'});
      if(type==='basketball-picks'&&Array.isArray(rows))setPicks({active:!!event.data.active,date:String(event.data.date||''),rows:rows.filter(item=>typeof item?.label==='string')});
      if(type==='basketball-route'&&typeof search==='string'&&search.startsWith('?')){
        const p=new URLSearchParams(search),view=p.get('view')||'';
        if(p.get('league')!==league||!FRONT_VIEWS.some(v=>v===view))return;
        const hash=typeof event.data.hash==='string'&&event.data.hash.startsWith('#')?event.data.hash:'';
        if(location.search+location.hash!==search+hash)window.history.pushState(null,'','/'+search+hash);
        onViewChange(view);
      }
    };
    window.addEventListener('message',receive);window.addEventListener('popstate',back);
    window.addEventListener('arena-refresh-all',refresh);window.addEventListener('regional-basketball-assistant',assistant);
    return()=>{window.removeEventListener('message',receive);window.removeEventListener('popstate',back);window.removeEventListener('arena-refresh-all',refresh);window.removeEventListener('regional-basketball-assistant',assistant);};
  },[league,onViewChange]);
  return <div data-super-league={league}>
    <iframe ref={frame} title={league==='NBL'?'澳洲職籃賽事與球員':'韓國職籃賽事與球員'} src={src} style={{display:'block',width:'100%',height,border:0,scrollMarginTop:'5rem'}}/>
    {picks.active&&<span hidden data-super-parlay={pane}/>}
    {workspace?.activePane===pane&&workspace.host&&createPortal(<section className="p-4"><h3>{league} 串關組合</h3><p>{picks.date}</p>{picks.rows.length?<ul>{picks.rows.map(row=><li key={row.label}>{row.selected?'已選・':''}{row.label}</li>)}</ul>:<p>目前沒有同時具備有效賽前盤口與模型預測的場次。</p>}</section>,workspace.host)}
  </div>;
}
