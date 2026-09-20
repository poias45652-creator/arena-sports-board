import {NextRequest, NextResponse} from 'next/server';
import {getRawDb} from './db';
import {gateRequest} from './server/request-gate';
export async function proxy(request: NextRequest) {
  const blocked = await gateRequest(request, getRawDb());
  if (blocked) return blocked;
  const safeHeaders = new Headers(request.headers);
  for (const name of [...safeHeaders.keys()]) if (name.toLowerCase().startsWith('oai-authenticated-')) safeHeaders.delete(name);
  return NextResponse.next({request:{headers:safeHeaders}});
}
export const config = {matcher:['/','/admin/:path*','/teams/:path*','/players/:path*','/api/:path*']};
