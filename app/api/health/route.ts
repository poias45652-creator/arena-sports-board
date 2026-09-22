import {getRawDb} from '@/db';
import {baseballBackgroundStatus} from '@/server/baseball-background-state.mjs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await getRawDb().prepare('SELECT COUNT(*) AS count FROM account_access').first();
    return Response.json({ok:true,service:'YJ體育分析',version:'v175-render.1',refresh:baseballBackgroundStatus()}, {headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({ok:false}, {status:503,headers:{'Cache-Control':'no-store'}});}
}
