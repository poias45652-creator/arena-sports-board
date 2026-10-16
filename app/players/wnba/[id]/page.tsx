import {notFound} from 'next/navigation';
import SportPlayerProfile from '@/app/sport-player-profile';
export const dynamic='force-dynamic';
export const metadata={title:'WNBA 球員資料｜星準'};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{provider?:string}>}){const [{id},q]=await Promise.all([params,searchParams]);if(!/^\d{1,10}$/.test(id)||Number(id)<=0||q.provider&&!['official','espn'].includes(q.provider))notFound();return <SportPlayerProfile key={id} id={id} league="WNBA" provider={q.provider||'official'}/>;}
