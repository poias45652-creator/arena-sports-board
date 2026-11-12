import {mtTrialWorkspace} from '@/lib/mt-trial-workspace';
export const dynamic='force-dynamic';
export function GET(request:Request){return mtTrialWorkspace(request,true);}
