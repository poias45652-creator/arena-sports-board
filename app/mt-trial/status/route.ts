import {guestTrial} from '@/lib/mt-trial-access';
export const dynamic = 'force-dynamic';
export const GET = (request:Request) => guestTrial(request,false);
