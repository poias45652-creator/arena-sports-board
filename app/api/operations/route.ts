import {isSiteAdmin} from '@/app/admin-access';
export const dynamic='force-dynamic';
export async function GET(){
 if(!(await isSiteAdmin()))return Response.json({error:'僅限管理者存取'},{status:403,headers:{'Cache-Control':'no-store'}});
 let collector:any={reachable:false,verified24Hours:false};
 try{
  const r=await fetch('https://arena-super007-cloud.poias45652.workers.dev/health',{signal:AbortSignal.timeout(8000),redirect:'manual'});
  if(r.ok){const d=await r.json(),h=d.last24Hours;if(h&&Number.isFinite(h.attempts)&&Number.isFinite(h.success)&&Number.isFinite(h.failed))collector={reachable:true,fresh:d.fresh===true,lastFetchedAt:d.lastFetchedAt??null,attempts:h.attempts,success:h.success,failed:h.failed,observedHours:h.observedHours,maxGapSeconds:h.maxGapSeconds,verified24Hours:false};}
 }catch{/* Report unavailable without exposing upstream responses. */}
 return Response.json({collector,mode:'request_refresh',backgroundStatus:'尚未完成獨立排程與連續 24 小時驗證；手動測試及網站瀏覽不算全天更新。',fetchedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
}
