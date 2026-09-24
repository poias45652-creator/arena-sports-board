'use client';
import {useEffect,useRef,useState,type CSSProperties,type PointerEvent,type MouseEvent} from 'react';
export function useFloatingDrag<T extends HTMLElement>(visible:boolean){
 const ref=useRef<T>(null),drag=useRef<{id:number;x:number;y:number;left:number;top:number;moved:boolean}|null>(null),suppress=useRef(false);
 const [position,setPosition]=useState<{left:number;top:number}|null>(null);
 const clamp=(left:number,top:number)=>{const r=ref.current?.getBoundingClientRect();return {left:Math.max(8,Math.min(left,window.innerWidth-(r?.width||0)-8)),top:Math.max(8,Math.min(top,window.innerHeight-(r?.height||0)-8))};};
 useEffect(()=>{const resize=()=>setPosition(p=>p?clamp(p.left,p.top):p);if(visible)resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[visible]);
 const onPointerDown=(e:PointerEvent)=>{if(e.button!==0||e.isPrimary===false||(e.target as HTMLElement).closest('button')!==ref.current&&(e.target as HTMLElement).closest('button'))return;const r=ref.current?.getBoundingClientRect();if(!r)return;suppress.current=false;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};ref.current?.setPointerCapture(e.pointerId);};
 const onPointerMove=(e:PointerEvent)=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>5)d.moved=true;if(d.moved){e.preventDefault();setPosition(clamp(d.left+dx,d.top+dy));}};
 const finish=(e:PointerEvent)=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;suppress.current=d.moved;drag.current=null;if(ref.current?.hasPointerCapture(e.pointerId))ref.current.releasePointerCapture(e.pointerId);};
 const onClickCapture=(e:MouseEvent)=>{if(suppress.current){suppress.current=false;e.preventDefault();e.stopPropagation();}};
 const style:CSSProperties|undefined=position?{left:position.left,top:position.top,right:'auto',bottom:'auto'}:undefined;
 return {ref,style,onPointerDown,onPointerMove,onPointerUp:finish,onPointerCancel:finish,onLostPointerCapture:finish,onClickCapture};
}
