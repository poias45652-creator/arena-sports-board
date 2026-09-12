import {GET as hrGET} from '../hr9988/route';
export const dynamic='force-dynamic';
export function GET(){return hrGET(new Request('https://arena.internal/api/hr9988'));}
