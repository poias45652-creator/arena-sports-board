import {isSiteAdmin} from '@/app/admin-access';
export const dynamic='force-dynamic';
export async function GET(){
 return Response.json({isAdmin:await isSiteAdmin()},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
}
