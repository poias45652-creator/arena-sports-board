import {notFound} from 'next/navigation';
import {parsePlayerQuery} from '@/lib/player-profile';
import PlayerProfile from '@/app/player-profile';
export const metadata={title:'球員數據｜YJ體育分析'};
export default async function PlayerPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{season?:string;type?:string}>}){
  const [{id},query]=await Promise.all([params,searchParams]);
  const options=parsePlayerQuery(id,query.season??null,query.type??null);if(!options)notFound();
  return <PlayerProfile key={options.id} id={options.id} initialSeason={options.season} initialType={options.gameType}/>;
}
