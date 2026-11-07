import footballCupAdjustmentRuntime from '@/data/football/cup-adjustment-runtime.json';
import {scheduleRevision,scheduleCatalog} from '@/lib/project-schedules';
import {getRawDb} from '@/db';
import {baseballBackgroundStatus} from '@/server/baseball-background-state.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request?:Request) {
  try {
    await getRawDb().prepare('SELECT COUNT(*) AS count FROM account_access').first();
    if(request&&new URL(request.url).searchParams.get('check')==='schedules'){
      const {tasks,synced}=await scheduleCatalog();
      return Response.json({ok:synced,revision:scheduleRevision,registered:tasks.length,enabled:tasks.filter(t=>t.enabled).length},{status:synced?200:503,headers:{'Cache-Control':'no-store'}});
    }
    return Response.json({ok:true,scheduleRevision,service:'星準',version:'v175-render.1',homepageRevision:'xingzhun-live-home-v1',aiAssistantRevision:'xingzhun-assistant-v13-match-scoreboard',adminAccountsRevision:'account-notes-direct-grants-v1',mlbMarketRevision:'mlb-postseason-source-v1',buttonFeedbackRevision:'xingzhun-site-buttons-v1',footballRevision:'football-custom-retention-v3',footballModelRevision:footballCupAdjustmentRuntime.version,footballMarketRevision:'football-market-grid-v2',memberOddsRevision:'member-odds-recovery-v2',footballSourceRevision:'football-source-forest-v1',regionalBasketballRevision:'nbl-kbl-rosters-v1',nbaMarketRevision:'nba-source-names-v2',refresh:baseballBackgroundStatus()}, {headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({ok:false}, {status:503,headers:{'Cache-Control':'no-store'}});}
}
