'use client';
import Link from 'next/link';
import {useState} from 'react';
import {Input} from '@/components/ui/input';
import {coversTeams} from '@/lib/covers';
import {teamZh} from './zh';
export default function TeamsDirectory(){const [search,setSearch]=useState('');const ids=Object.keys(coversTeams).map(Number).filter(id=>teamZh({id}).includes(search)||coversTeams[id].includes(search.toLowerCase()));return <section aria-label="MLB 球隊一覽"><div className="standings-heading"><h2 className="text-xl font-bold">球隊一覽</h2><Input className="max-w-xs" aria-label="搜尋球隊" placeholder="搜尋球隊" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="team-directory">{ids.map(id=><Link href={`/teams/${id}`} className="panel team-directory-card" key={id}><img src={`https://www.mlbstatic.com/team-logos/${id}.svg`} width={44} height={44} alt="" loading="lazy"/><span>{teamZh({id})}</span><small>查看球隊資料 →</small></Link>)}</div>{!ids.length&&<p className="p-5">找不到符合的球隊。</p>}</section>;}
