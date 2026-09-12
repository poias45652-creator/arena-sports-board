import Link from 'next/link';
import type {ReactNode} from 'react';
import {playerLink} from '@/lib/player-profile';
export default function PlayerLink({id,season,gameType,children,className=''}:{id:number|null|undefined;season?:number|string;gameType?:string;children:ReactNode;className?:string}){
  const href=playerLink(id,season,gameType);
  return href?<Link href={href} prefetch={false} className={`player-link ${className}`}>{children}</Link>:<>{children}</>;
}
