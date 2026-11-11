import {redirect} from 'next/navigation';
import {adminHome} from '@/lib/admin-navigation';

export default async function AdminPage({searchParams}:{searchParams:Promise<{view?:string}>}) {
  const {view}=await searchParams;
  redirect(view==='system'?'/admin/system':adminHome);
}
