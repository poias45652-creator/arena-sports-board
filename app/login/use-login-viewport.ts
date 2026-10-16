'use client';
import {useEffect, useRef} from 'react';

// Keep the complete login card inside the visible screen, including the keyboard.
export function useLoginViewport() {
 const mainRef = useRef<HTMLElement>(null);
 useEffect(() => {
  const main = mainRef.current;
  const panel = main?.querySelector<HTMLElement>('.panel');
  if (!main || !panel) return;
  const viewport = window.visualViewport;
  let frame = 0;
  const update = () => {
   cancelAnimationFrame(frame);
   frame = requestAnimationFrame(() => {
    const height = viewport?.height ?? window.innerHeight;
    main.style.setProperty('--xz-login-height', `${height}px`);
    main.style.setProperty('--xz-login-top', `${viewport?.offsetTop ?? 0}px`);
    const typing = main.contains(document.activeElement) && document.activeElement?.matches('input');
    main.dataset.keyboardOpen = String(Boolean(typing && height < 500));
    const style = getComputedStyle(main);
    const available = height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    main.style.setProperty('--xz-login-scale', String(Math.min(1, Math.max(0, available) / panel.offsetHeight)));
   });
  };
  const observer = new ResizeObserver(update);
  observer.observe(panel);
  window.addEventListener('resize', update);
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  main.addEventListener('focusin', update);
  main.addEventListener('focusout', update);
  update();
  return () => {
   cancelAnimationFrame(frame);
   observer.disconnect();
   window.removeEventListener('resize', update);
   viewport?.removeEventListener('resize', update);
   viewport?.removeEventListener('scroll', update);
   main.removeEventListener('focusin', update);
   main.removeEventListener('focusout', update);
  };
 }, []);
 return mainRef;
}
