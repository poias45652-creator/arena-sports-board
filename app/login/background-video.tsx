'use client';
import {useEffect, useState} from 'react';

export default function BackgroundVideo() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
    const update = () => {
      const slow = connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType ?? '');
      setEnabled(!motion.matches && !slow);
    };
    // No MP4 source on first paint: prioritize the login form and session settings.
    const timer = window.setTimeout(update, 3000);
    const reduceMotion = () => { if (motion.matches) setEnabled(false); };
    motion.addEventListener('change', reduceMotion);
    return () => { window.clearTimeout(timer); motion.removeEventListener('change', reduceMotion); };
  }, []);
  return <video className="yj-login-video" autoPlay={enabled} muted loop playsInline
    preload="none" poster="/backgrounds/yankee-stadium.jpg" aria-hidden="true"
    src={enabled ? '/0912-bg.mp4' : undefined}/>;
}
