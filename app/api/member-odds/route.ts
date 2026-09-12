import {GET as hrGET} from '../hr9988/route';
export const dynamic='force-dynamic';
export function GET(request:Request){return hrGET(request);}
