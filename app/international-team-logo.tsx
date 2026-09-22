import {internationalTeam} from '@/lib/international-teams';
import {internationalTeamLogoPath} from '@/lib/international-team-logo-path';
export default function InternationalTeamLogo({league,name,size=48}:{league:string;name:string;size?:number}){
 name=internationalTeam(name,league);const src=internationalTeamLogoPath(league,name);
 return <span className="grid shrink-0 place-items-center" style={{width:size,height:size}}>{src?<img src={src} alt={`${name}隊標`} width={size} height={size} className={`object-contain${league==='NPB'?' rounded-md bg-white p-0.5':''}`} style={{width:size,height:size}}/>:<span className="text-xs text-slate-400" title={`${name}隊標尚未取得`}>隊標待補</span>}</span>;
}
