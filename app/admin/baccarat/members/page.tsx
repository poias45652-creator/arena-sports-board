import {adminIdentity} from '../../../admin-access';
import {baccaratSections} from '@/lib/baccarat-admin';
import {isYjViewerSite} from '@/lib/arena-session';
import {leaguePageHref} from '@/lib/sport-navigation';
import ViewerAccount from '../../viewer-account';
import MemberConsole from './console';
import './members.css';

export const dynamic='force-dynamic';
export const metadata={title:'會員授權｜星準'};
export default async function MembersPage() {
  if(!await adminIdentity()) return <main className="p-8"><h1>僅限管理者存取</h1><a href="/login?admin=1">使用管理員帳號登入</a></main>;
  return <main className="membership">
    <div className="member-shell">
      <aside className="member-sidebar">
        <strong className="member-brand"><span aria-hidden="true">星</span>星準管理後台</strong>
        <nav aria-label="後台導覽">
          <a href="/admin">返回體育後台</a>
          <a href="/admin/baccarat/dashboard">主控台</a>
          <a href="/admin/baccarat/members" aria-current="page">會員授權</a>
          <a href="/admin/baccarat/users">百家樂會員資料</a>
          <a href="/admin/baccarat/permissions">{baccaratSections.permissions}</a>
          <a href="/admin/baccarat/settings">百家樂系統設定</a>
          <a href="/admin?view=system">體育系統設定</a>
          <a href="/admin/schedules">排程管理</a>
          <a href="/admin/baccarat/logs">操作紀錄</a>
          <a href={leaguePageHref('MLB')}>返回賽事</a>
        </nav>
        <form action="/platforms/logout" method="post"><button type="submit">登出管理後台</button></form>
      </aside>
      <div className="member-content">
        <header><h1>會員授權</h1><p>體育與百家樂可分別開通，百家樂授權適用於 DG 與 MT。</p></header>
        <div id="member-console"><MemberConsole/></div>
        {isYjViewerSite()&&<details className="member-viewer"><summary>唯讀測試帳號設定</summary><ViewerAccount/></details>}
      </div>
    </div>
  </main>;
}
