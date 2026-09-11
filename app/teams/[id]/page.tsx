import {notFound} from 'next/navigation';
import {coversTeams} from '@/lib/covers';
import {teamZh} from '@/app/zh';
import TeamProfile from '../../team-profile';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;return {title:`${teamZh({id:Number(id)})}｜Arena 球隊資料`};}
export default async function TeamPage({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!coversTeams[Number(id)])notFound();return <TeamProfile id={Number(id)}/>;}
