'use client';
import {useEffect,useRef,useState} from 'react';
import FootballCompetitionNav from './football-competition-nav';

export default function HongKongFootballBoard(){
  const frame = useRef<HTMLIFrameElement>(null);
  const [height,setHeight] = useState(680);
  const [src] = useState(()=>'/hong-kong/board'+window.location.search);
  useEffect(()=>{
    function receive(e:MessageEvent){
      if(e.origin!==location.origin || e.source!==frame.current?.contentWindow)return;
      if(e.data?.type==='hk-football-height' && Number.isFinite(e.data.height)){
        setHeight(Math.max(320,Math.ceil(e.data.height)));
      }
      if(e.data?.type==='hk-football-route' && typeof e.data.search==='string'){
        const board=new URLSearchParams(e.data.search);
        const next=new URLSearchParams({league:'FOOTBALL',competition:'hkg.1'});
        for(const key of ['view','date','range','game'])if(board.has(key))next.set(key,board.get(key)!);
        history.replaceState(null,'','/?'+next);
      }
    }
    window.addEventListener('message',receive);
    return ()=>window.removeEventListener('message',receive);
  },[]);
  return <section className="football-board" data-super-league="FOOTBALL" aria-label="香港足球分析">
    <div className="football-heading"><div><h1>香港超級聯賽</h1><p>2026/27 港超聯・賽程、比分與賽前機率</p></div><span className="football-model-tag">90 分鐘分析</span></div>
    <FootballCompetitionNav selected="hkg.1"/>
    <iframe ref={frame} title="香港超級聯賽賽事分析" src={src} style={{display:'block',width:'100%',height,border:0}}/>
  </section>;
}
