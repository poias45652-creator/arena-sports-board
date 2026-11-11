import type {ReactNode} from 'react';
import {adminIdentity} from '../admin-access';
import {isYjViewerSite} from '@/lib/arena-session';
import AdminWorkspace from './workspace';
import './baccarat/members/members.css';

export const dynamic='force-dynamic';

export default async function AdminLayout({children}:{children:ReactNode}) {
  if (!await adminIdentity()) return <main className="p-8"><h1>僅限管理者存取</h1><a href="/login?admin=1">使用管理員帳號登入</a></main>;
  return <AdminWorkspace viewer={isYjViewerSite()}>{children}</AdminWorkspace>;
}
