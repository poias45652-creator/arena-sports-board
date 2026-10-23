import footballCupAdjustmentRuntime from '@/data/football/cup-adjustment-runtime.json';
import {getRawDb} from '@/db';
import {baseballBackgroundStatus} from '@/server/baseball-background-state.mjs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await getRawDb().prepare('SELECT COUNT(*) AS count FROM account_access').first();
    return Response.json({ok:true,service:'星準',version:'v175-render.1',aiAssistantRevision:'xingzhun-assistant-v9-source-recovery',buttonFeedbackRevision:'xingzhun-site-buttons-v1',footballRevision:'football-custom-retention-v3',footballModelRevision:footballCupAdjustmentRuntime.version,footballMarketRevision:'football-market-grid-v2',nbaMarketRevision:'nba-source-names-v2',refresh:baseballBackgroundStatus()}, {headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({ok:false}, {status:503,headers:{'Cache-Control':'no-store'}});}
}
