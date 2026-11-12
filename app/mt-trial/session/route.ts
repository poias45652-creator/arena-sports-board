import {getPool} from '@/server/database.mjs';
import {getRawDb} from '@/db';
import {readTurnstileSettings} from '@/lib/turnstile-settings';
import {logoutTrial,sameTrialOrigin,trialLogin,trialReply} from '@/lib/mt-trial-accounts';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  if(!sameTrialOrigin(request))return trialReply({error:'請從星準試玩登入頁操作。'},403);
  try{return await trialLogin(getPool(),request,await readTurnstileSettings(getRawDb(),process.env.TZ_BINDING_KEY));}
  catch{return trialReply({error:'試玩登入服務暫時無法使用，請稍後再試。'},503);}
}
export async function DELETE(request:Request){
  if(!sameTrialOrigin(request))return trialReply({error:'請從星準試玩頁操作。'},403);
  return logoutTrial(getPool(),request);
}
