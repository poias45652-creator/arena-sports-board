import {notFound} from 'next/navigation';
import SportPlayerProfile from '@/app/sport-player-profile';
export const dynamic='force-dynamic';
export const metadata={title:'WNBA 球員資料｜星準'};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{provider?:string;season?:string}>}){
 const [{id},{provider,season}]=await Promise.all([params,searchParams]);
 if(!/^\d{1,10}$/.test(id)||Number(id)<=0||provider&&!['official','espn'].includes(provider))notFound();
 if(season!==undefined&&(!/^\d{4}$/.test(season)||Number(season)<1997||Number(season)>new Date().getUTCFullYear()+1))notFound();
 return <SportPlayerProfile key={`${id}-${provider||'official'}-${season||''}`} id={id} league="WNBA" provider={provider||'official'} initialSeason={season?Number(season):undefined}/>;
}
