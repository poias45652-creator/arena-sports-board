import {launchMtTrial} from '@/lib/mt-trial';
export const dynamic='force-dynamic';
export function POST(request:Request){return launchMtTrial(request,{enabled:process.env.OFA_MT_TRIAL_ENABLED,password:process.env.OFA_MT_TRIAL_PASSWORD});}
