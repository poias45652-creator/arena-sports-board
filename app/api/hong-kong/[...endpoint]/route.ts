import service from '@/modules/hong-kong-football/server/index.js';

export const dynamic = 'force-dynamic';
const endpoints = new Set(['football','football/odds','football-team','sport-player']);

export async function GET(request: Request, context: {params: Promise<{endpoint:string[]}>}) {
  const endpoint = (await context.params).endpoint.join('/');
  if (!endpoints.has(endpoint)) return new Response(null,{status:404});
  const url = new URL(request.url);
  url.pathname = '/api/' + endpoint;
  const response = await service.fetch(new Request(url,{method:request.method}),{ODDS_API_KEY:process.env.ODDS_API_KEY},{
    waitUntil(task: Promise<unknown>) { void task.catch(() => {}); }
  });
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
