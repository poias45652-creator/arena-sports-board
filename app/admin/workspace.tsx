'use client';
import {Activity,type ReactNode} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {adminLinks,adminHome} from '@/lib/admin-navigation';
import ViewerAccount from './viewer-account';
import MemberConsole from './baccarat/members/console';

export default function AdminWorkspace({children,viewer}:{children:ReactNode;viewer:boolean}) {
  const path=usePathname();
  const members=path===adminHome;
  return <div className="membership">
    <div className="member-shell">
      <aside className="member-sidebar">
        <strong className="member-brand"><span aria-hidden="true">星</span>星準管理後台</strong>
        <nav aria-label="後台導覽">{adminLinks.map(({href,label})=><Link key={href} href={href} prefetch={false} aria-current={href===path?'page':undefined}>{label}</Link>)}</nav>
        <form action="/platforms/logout" method="post"><button type="submit">登出管理後台</button></form>
      </aside>
      <div className="member-content">
        <Activity mode={members?'visible':'hidden'}>
          <main aria-label="會員管理">
            <header><h1>會員管理</h1><p>體育與百家樂可分別開通，百家樂授權適用於 DG 與 MT。</p></header>
            <div id="member-console"><MemberConsole/></div>
            {viewer&&<details className="member-viewer"><summary>唯讀測試帳號設定</summary><ViewerAccount/></details>}
          </main>
        </Activity>
        {children}
      </div>
    </div>
  </div>;
}
