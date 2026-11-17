import {sportsAdministrator} from '@/app/admin-access';

export const dynamic='force-dynamic';

export async function GET() {
  const authenticated=Boolean(await sportsAdministrator());
  return Response.json({authenticated},{status:authenticated?200:403,headers:{'Cache-Control':'private, no-store'}});
}
