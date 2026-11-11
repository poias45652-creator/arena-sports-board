import {notFound,redirect} from 'next/navigation';
import {sportsAdministrator} from '@/app/admin-access';
import {adminHome,baccaratSections,isBaccaratSection} from '@/lib/admin-navigation';
import {baccaratAdminRequest,baccaratPanelDocument} from '@/lib/baccarat-admin';

export const dynamic='force-dynamic';
export default async function BaccaratSectionPage({params}:{params:Promise<{section:string}>}) {
  const {section}=await params;
  if(section==='users')redirect(adminHome);
  if (!isBaccaratSection(section)||section==='members') notFound();
  const actor=await sportsAdministrator();
  if (!actor) return <p>僅限管理員存取。</p>;
  let panel:string|null=null;
  try {
    const response=await baccaratAdminRequest(actor,'GET','/admin/'+section);
    if(response.ok&&response.headers.get('content-type')?.includes('text/html')) {
      panel=baccaratPanelDocument(await response.text());
    }
  } catch {}
  return panel?<iframe key={section} title={baccaratSections[section]} className="baccarat-admin-panel" srcDoc={panel} referrerPolicy="same-origin"/>:
    <section role="alert"><h1>{baccaratSections[section]}</h1><p>百家樂管理服務暫時無法連線。</p><a href={'/admin/baccarat/'+section}>重新載入</a></section>;
}
