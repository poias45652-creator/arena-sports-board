import {guestTrial} from '@/lib/mt-trial-access';
export const dynamic = 'force-dynamic';
export const POST = (request:Request) => guestTrial(request,true);
