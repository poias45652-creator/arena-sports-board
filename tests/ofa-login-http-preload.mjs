// Only used by the local Render HTTP smoke server, with its isolated database.
import './render-http-preload.mjs';

const localFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (['localhost', '127.0.0.1'].includes(url.hostname)) return localFetch(input, init);
  if (url.href !== 'https://www.ofa1188.net/api/v1/login') return new Response(null, {status: 503});
  const request = new Request(input, init);
  if (request.method !== 'POST') return new Response(null, {status: 405});
  const {username, password} = await request.json();
  if (username !== 'vrv01' || password !== 'local-fixture-only') return new Response(null, {status: 401});
  const claims = Buffer.from(JSON.stringify({exp: Math.floor(Date.now() / 1000) + 3600})).toString('base64url');
  return Response.json({code: 200, data: {username, user_id: 'smoke-admin', token: 'fixture.' + claims + '.test'}});
};
