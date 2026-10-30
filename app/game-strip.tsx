'use client';

import {useEffect, useId, useRef, useState, type PointerEvent, type ReactNode} from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import './game-strip.css';

/** Shared navigation for every sport's live match picker. */
export default function GameStrip({children, className, count, resetKey, label = '全部賽事，可左右滑動', caption}: {
  children: ReactNode;
  className: string;
  count: number;
  resetKey?: string;
  label?: string;
  caption?: string;
}) {
  const id = useId();
  const strip = useRef<HTMLDivElement>(null);
  const drag = useRef<{id: number; x: number; left: number; moved: boolean} | null>(null);
  const suppressClick = useRef(false);
  const [edges, setEdges] = useState({left: false, right: false});

  function updateEdges() {
    const el = strip.current;
    if (!el) return;
    const left = el.scrollLeft > 2, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges(previous => previous.left === left && previous.right === right ? previous : {left, right});
  }

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    el.scrollLeft = 0;
    updateEdges();
  }, [resetKey]);

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [children]);

  function scrollGames(direction: number) {
    const el = strip.current;
    if (!el) return;
    el.scrollBy({left: direction * el.clientWidth * .8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    // Touch and trackpad use native scrolling, including vertical page gestures.
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag.current = {id: event.pointerId, x: event.clientX, left: event.currentTarget.scrollLeft, moved: false};
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const distance = event.clientX - current.x;
    if (!current.moved && Math.abs(distance) < 6) return;
    current.moved = true;
    suppressClick.current = true;
    const el = event.currentTarget;
    el.dataset.dragging = 'true';
    if (!el.hasPointerCapture(event.pointerId)) el.setPointerCapture(event.pointerId);
    event.preventDefault();
    el.scrollLeft = current.left - distance;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    delete event.currentTarget.dataset.dragging;
  }

  return <div className="game-strip-picker">
    {count > 0 && <div className="game-strip-controls">
      <span>共 {count} 場 · 左右滑動或拖曳查看全部{caption ? ` · ${caption}` : ''}</span>
      <div>
        <button type="button" aria-label="向左查看賽事" aria-controls={id} disabled={!edges.left} onClick={() => scrollGames(-1)}><ChevronLeft size={20}/></button>
        <button type="button" aria-label="向右查看賽事" aria-controls={id} disabled={!edges.right} onClick={() => scrollGames(1)}><ChevronRight size={20}/></button>
      </div>
    </div>}
    <div ref={strip} id={id} className={`${className} game-strip-scroll`} role="group" aria-label={label} tabIndex={0}
      onScroll={updateEdges} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
      onPointerLeave={event => {if (!drag.current?.moved) endDrag(event);}}
      onDragStart={event => event.preventDefault()}
      onClickCapture={event => {if (suppressClick.current && event.detail > 0) {event.preventDefault(); event.stopPropagation(); suppressClick.current = false;}}}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); scrollGames(event.key === 'ArrowRight' ? 1 : -1);}
        if (event.key === 'Home' || event.key === 'End') {event.preventDefault(); event.currentTarget.scrollLeft = event.key === 'Home' ? 0 : event.currentTarget.scrollWidth;}
      }}>
      {children}
    </div>
  </div>;
}
