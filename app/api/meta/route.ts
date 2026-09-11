import {adminExists} from '../../../server/auth.mjs';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json({ok:true,setupRequired:!(await adminExists()),adminSetupVersion:3},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'帳號服務暫時無法使用。'},{status:503});}}
