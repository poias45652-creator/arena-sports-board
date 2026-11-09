import {getRawDb} from '@/db';
import {openBaccaratGame} from '@/lib/baccarat-game';
export const dynamic='force-dynamic';
export function POST(request:Request){return openBaccaratGame(request,getRawDb());}
