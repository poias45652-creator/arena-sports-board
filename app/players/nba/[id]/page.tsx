import {notFound} from 'next/navigation';
import SportPlayerProfile from '@/app/sport-player-profile';
export const dynamic='force-dynamic';
export const metadata={title:'NBA 球員資料｜星準'};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!/^\d{1,10}$/.test(id)||Number(id)<=0)notFound();return <SportPlayerProfile key={id} id={id} league="NBA"/>;}
