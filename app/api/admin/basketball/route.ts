import {isSiteAdmin} from '@/app/admin-access';
import {GET as nbaGet} from '../../nba/route';
import {GET as wnbaGet} from '../../wnba/route';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};

export async function GET(request:Request){
 if(!await isSiteAdmin())return Response.json({error:'僅限管理員'},{status:403,headers});
 const p=new URL(request.url).searchParams,league=p.get('league'),kind=p.get('kind')||'schedule';
 if(!['NBA','WNBA'].includes(league||'')||!['schedule','analysis'].includes(kind))return Response.json({error:'籃球查詢參數錯誤'},{status:400,headers});
 return league==='NBA'?nbaGet(request):wnbaGet(request);
}
