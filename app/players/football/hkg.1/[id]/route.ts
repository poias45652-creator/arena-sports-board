import {footballShell} from '@/modules/hong-kong-football/shell';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: {params: Promise<{id:string}>}) {
  const {id} = await context.params;
  if (!/^[0-9]{1,12}$/.test(id)) return new Response(null,{status:404});
  return footballShell();
}
