import {GET as sourceGET} from '@/app/api/baseball/route';
export async function loadSource(kind:string){const r=await sourceGET(new Request('https://arena.internal/api/baseball?kind='+kind));if(!r.ok)throw new Error('來源不可用');return r.json();}
