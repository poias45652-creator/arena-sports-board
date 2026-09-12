'use client';

import {useState} from 'react';
import {LogOut} from 'lucide-react';
import {Button} from '@/components/ui/button';

export default function LogoutButton({label = '登出'}: {label?: string}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('logout_failed');
      window.location.replace('/login');
    } catch {
      setError('登出未完成，請檢查連線後再試一次。');
      setBusy(false);
    }
  }

  return <div className="relative shrink-0">
    <Button type="button" variant="outline" disabled={busy} onClick={() => void logout()} className="border-slate-500 bg-[#0e1a29] font-bold text-slate-100 hover:bg-[#1a2b3e] hover:text-white">
      <LogOut className="size-4" aria-hidden="true"/>{busy ? '登出中…' : label}
    </Button>
    {error && <p role="alert" className="absolute right-0 top-full z-30 mt-2 w-64 rounded-md border border-amber-300/40 bg-[#0e1a29] p-3 text-sm text-amber-200 shadow-lg">{error}</p>}
  </div>;
}
