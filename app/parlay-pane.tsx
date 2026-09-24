'use client';
import {useId,useLayoutEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useSuperWorkspace} from './super-workspace';

export default function ParlayPane({children}:{children:ReactNode}){
 const id=useId(),superWorkspace=useSuperWorkspace(),docked=superWorkspace?.activePane===id&&!!superWorkspace.host;
 const ref=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const pane=ref.current;
  const workspace=pane?.closest<HTMLElement>('.league-workspace');
  const controls=pane?.closest('.arena-analysis-board')?.querySelector<HTMLElement>('.arena-analysis-controls');
  if(!pane||!workspace||!controls)return;
  let frame=0;
  const desktop=window.matchMedia('(min-width:1024px)');
  const measure=()=>{
   frame=0;
   if(!desktop.matches||workspace.dataset.view!=='analysis'){
    pane.style.removeProperty('--analysis-summary-height');return;
   }
   const lastLine=controls.lastElementChild;
   if(!lastLine||!controls.getBoundingClientRect().width)return;
   const height=lastLine.getBoundingClientRect().bottom-pane.getBoundingClientRect().top;
   const value=`${height}px`;
   if(height>0&&pane.style.getPropertyValue('--analysis-summary-height')!==value)pane.style.setProperty('--analysis-summary-height',value);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  const resize=new ResizeObserver(schedule);
  const observeLayout=()=>{
   resize.disconnect();
   [workspace,controls,...controls.children,workspace.querySelector('.league-tabs'),workspace.querySelector('.arena-pregame-toolbar')].forEach(node=>{if(node)resize.observe(node);});
  };
  const changes=new MutationObserver(()=>{observeLayout();schedule();});
  changes.observe(controls,{childList:true,subtree:true,characterData:true});
  changes.observe(workspace,{attributes:true,attributeFilter:['data-view']});
  observeLayout();measure();window.addEventListener('resize',schedule);
  return()=>{cancelAnimationFrame(frame);resize.disconnect();changes.disconnect();window.removeEventListener('resize',schedule);};
 },[docked]);
 return <div ref={ref} data-super-parlay={id} className="arena-parlay-pane arena-parlay-top" role="region" aria-label="串關組合，可獨立捲動" tabIndex={0}>{docked?createPortal(children,superWorkspace!.host!):children}</div>;
}

