import {notFound} from 'next/navigation';
import {isFootballLeague} from '@/lib/football';
import SportPlayerProfile from '@/app/sport-player-profile';
export const dynamic='force-dynamic';
export const metadata={title:'足球球員資料｜星準'};
export default async function Page({params,searchParams}:{params:Promise<{id:string;league:string}>;searchParams:Promise<{team?:string;season?:string}>}){const [{id,league},q]=await Promise.all([params,searchParams]);if(!/^\d{1,12}$/.test(id)||Number(id)<=0||!isFootballLeague(league)||q.team&&!/^\d{1,12}$/.test(q.team)||q.season&&(!/^\d{4}$/.test(q.season)||Number(q.season)<1947||Number(q.season)>new Date().getUTCFullYear()+1))notFound();return <SportPlayerProfile key={league+id} id={id} league={league} team={q.team||''} initialSeason={q.season?Number(q.season):undefined}/>;}
