import {mtTrialWorkspace} from '@/lib/mt-trial-workspace';
export const dynamic='force-dynamic';
export function GET(){return mtTrialWorkspace(false);}
