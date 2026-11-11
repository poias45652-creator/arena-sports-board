import {createHmac} from 'node:crypto';

const service='https://xingzhun-original-test.onrender.com';
const endpoints:Record<string,RegExp>={
  GET:/^(?:health|platform-members|dashboard-data|users|permissions|settings|logs|agents)$/,
  POST:/^(?:platform-members\/(?:sports|baccarat)|users|agents|settings|users\/\d+\/(?:status|extend|permissions))$/,
  PATCH:/^(?:users\/\d+\/agent|agents\/\d+)$/,
  DELETE:/^users\/\d+$/,
};
export function allowedAdminApi(method:string,path:string) {
  return endpoints[method]?.test(path) ?? false;
}

export async function baccaratAdminRequest(actor:string,method:string,path:string,body='') {
  const key=process.env.XZ_PLATFORM_BRIDGE_KEY;
  if(!key||key.length<40)throw Error('管理服務尚未連線');
  const time=String(Date.now());
  const signature=createHmac('sha256',key).update(['xz-sports-admin-v1',time,actor,method,path,body].join('\n')).digest('hex');
  return fetch(service+path,{method,cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(18000),
    headers:{'x-xz-admin-time':time,'x-xz-admin-actor':actor,'x-xz-admin-signature':signature,
      'Content-Type':'application/json','Origin':service},...(body?{body}:{})});
}

// Upstream scripts bind to their logout element on initialization. Hide its
// entire original sidebar so only the parent workspace handles navigation.
export function baccaratPanelDocument(document:string) {
  const panelStyle='<style>html,body{display:block;min-height:0;padding:0;background:#070f14}.admin-app{display:block;width:100%;min-height:0;border:0;border-radius:0;box-shadow:none}.admin-app>.sidebar{display:none}.admin-app>.content{padding:0}</style>';
  return document.replace('</head>',panelStyle+'</head>')
    .replaceAll('/api/admin/logout','/platforms/logout')
    .replaceAll('/api/admin/','/api/admin/baccarat/')
    .replaceAll('/api/health','/api/admin/baccarat/health')
    .replaceAll('href="/admin/','target="_parent" href="/admin/baccarat/')
    .replaceAll('牌靴 METRIX','星準百家樂')
    .replaceAll('METRIX ADMIN','星準管理後台');
}
