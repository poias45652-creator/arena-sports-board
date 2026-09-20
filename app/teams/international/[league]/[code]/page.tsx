import {notFound} from 'next/navigation';
import InternationalTeamProfile from '@/app/international-team-profile';
import {profileTeams,type ProfileLeague} from '@/lib/international-profile';
export const dynamic='force-dynamic';
export default async function InternationalTeamPage({params}:{params:Promise<{league:string;code:string}>}){const p=await params,league=p.league.toUpperCase() as ProfileLeague;if(!['CPBL','NPB','KBO'].includes(league)||!Object.hasOwn(profileTeams[league],p.code))notFound();const now=new Date(Date.now()+8*60*60*1000);return <InternationalTeamProfile key={`${league}:${p.code}`} league={league} code={p.code} season={now.getUTCFullYear()} initialMonth={now.getUTCMonth()+1}/>;}
