import {getArenaUser} from '@/lib/arena-user';
export async function isSiteAdmin(){return (await getArenaUser())?.role==='admin';}
