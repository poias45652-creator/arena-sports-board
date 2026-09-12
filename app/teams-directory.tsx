'use client';
import Link from 'next/link';
import {useState} from 'react';
import {Input} from '@/components/ui/input';
import {coversTeams} from '@/lib/covers';
import {teamLeagues} from '@/lib/team-groups';
import {teamZh} from './zh';
export default function TeamsDirectory(){
 const [search,setSearch]=useState('');
 const ids=Object.keys(coversTeams).map(Number).filter(id=>teamZh({id}).includes(search)||coversTeams[id].includes(search.toLowerCase()));
 const leagues=teamLeagues.map(league=>({...league,divisions:league.divisions.map(division=>({...division,teams:division.teams.filter(id=>ids.includes(id))})).filter(division=>division.teams.length)})).filter(league=>league.divisions.length);
 return <section aria-label="MLB 球隊一覽">
  <div className="standings-heading"><h2 className="text-xl font-bold">球隊一覽</h2><Input className="max-w-xs" aria-label="搜尋球隊" placeholder="搜尋球隊" value={search} onChange={e=>setSearch(e.target.value)}/></div>
  <div className="space-y-10">{leagues.map(league=><section key={league.id} aria-label={league.name} className="space-y-6">
   <h3 className="border-b border-white/10 pb-3 text-xl font-bold text-[#ffd538]">{league.name}</h3>
   {league.divisions.map(division=><section key={division.id} aria-label={`${league.name}${division.name}`} className="space-y-3">
    <h4 className="text-lg font-bold">{division.name}</h4>
    <div className="team-directory">{division.teams.map(id=><Link href={`/teams/${id}`} className="panel team-directory-card" key={id}><img src={`/team-logos/${id}.svg`} width={44} height={44} alt="" loading="lazy"/><span>{teamZh({id})}</span><small>查看球隊資料 →</small></Link>)}</div>
   </section>)}
  </section>)}</div>
  {!ids.length&&<p className="p-5">找不到符合的球隊。</p>}
 </section>;
}
