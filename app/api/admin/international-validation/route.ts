import {isSiteAdmin} from '@/app/admin-access';
import historical from '@/data/international-validation.json';
import {readInternationalForecastAudit} from '@/lib/international-model-audit-store';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
 if(!await isSiteAdmin())return Response.json({error:'僅限管理員'},{status:403,headers});
 try{return Response.json({historical,prospective:await readInternationalForecastAudit(),error:null},{headers});}
 catch{return Response.json({historical,prospective:null,error:'真實賽前留存紀錄暫時讀取失敗，不能視為零筆或驗證完成。'},{headers});}
}
