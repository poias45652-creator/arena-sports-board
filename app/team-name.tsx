'use client';
import {teamZh} from './zh';

type Team = {id?:number;name?:string};

export function TeamLogo({id,size=24}:{id?:number;size?:number}){
  if(!id)return null;
  return <img src={`/team-logos/${id}.svg`} alt="" width={size} height={size} loading="lazy" decoding="async" className="inline-block shrink-0 object-contain align-middle" style={{width:size,height:size}}/>;
}

export default function TeamName({team,size=24}:{team:Team;size?:number}){
  return <span className="inline-flex max-w-full items-center gap-2 align-middle"><TeamLogo id={team.id} size={size}/><span>{teamZh(team)}</span></span>;
}
