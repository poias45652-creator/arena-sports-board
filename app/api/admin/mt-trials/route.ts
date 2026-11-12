import {isSiteAdmin} from '@/app/admin-access';
import {getPool} from '@/server/database.mjs';
import {issueTrialAccount,sameTrialOrigin,trialReply} from '@/lib/mt-trial-accounts';
export const dynamic='force-dynamic';
const denied=()=>trialReply({error:'僅限星準管理員操作。'},403);
export async function GET(){
  if(!await isSiteAdmin())return denied();
  const {rows}=await getPool().query('SELECT username, enabled FROM mt_trial_accounts ORDER BY created_at DESC');
  return trialReply({accounts:rows});
}
export async function POST(request:Request){
  if(!sameTrialOrigin(request)||!await isSiteAdmin())return denied();
  return trialReply(await issueTrialAccount(getPool()),201);
}
export async function DELETE(request:Request){
  if(!sameTrialOrigin(request)||!await isSiteAdmin())return denied();
  const username=new URL(request.url).searchParams.get('username')||'';
  const {rows}=await getPool().query('UPDATE mt_trial_accounts SET enabled=false,session_hash=NULL,session_until=NULL WHERE username=$1 RETURNING id',[username]);
  return rows.length?trialReply({ok:true}):trialReply({error:'找不到這組帳號。'},404);
}
