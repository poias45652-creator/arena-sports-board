import {nbaTeam} from '@/lib/nba';
import {notFound} from 'next/navigation';
import SportPlayerProfile from '@/app/sport-player-profile';
export const dynamic='force-dynamic';
export const metadata={title:'NBA 球員資料｜星準'};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{team?:string;season?:string}>}){
 const [{id},{team,season}]=await Promise.all([params,searchParams]);
 if(!/^\d{1,10}$/.test(id)||Number(id)<=0||team&&!nbaTeam(team)||season&&(!/^\d{4}$/.test(season)||Number(season)<1947||Number(season)>new Date().getUTCFullYear()+1))notFound();
 return <SportPlayerProfile key={`${id}-${team||''}-${season||''}`} id={id} league="NBA" team={team} initialSeason={season?Number(season):undefined}/>;
}
