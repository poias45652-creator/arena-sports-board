import {createHmac} from 'node:crypto';

const service='https://xingzhun-original-test.onrender.com';
export const baccaratSections={
  members:'會員授權',dashboard:'百家樂主控台',users:'會員與代理分組',
  permissions:'會員模組權限',settings:'系統與功能總開關',logs:'操作紀錄',
} as const;

const endpoints:Record<string,RegExp>={
  GET:/^(?:platform-members|dashboard-data|users|permissions|settings|logs|agents)$/,
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

// The six server-rendered views use shared templates. Mount their navigation and
// AJAX calls under the sports admin, keeping the sports session on this origin.
export function sportsAdminDocument(document:string) {
  return document
    .replaceAll('https://arena-sports-board.onrender.com/admin?view=system','/admin')
    .replaceAll('href="/admin/', 'href="/admin/baccarat/')
    .replaceAll('/api/admin/logout','/platforms/logout')
    .replaceAll('/api/admin/', '/api/admin/baccarat/')
    .replaceAll("location.replace('/admin')","location.replace('/login?admin=1')")
    .replaceAll("location.assign('/admin')","location.assign('/login?admin=1')")
    .replaceAll('<div class="mark">M</div>','<div class="mark">星</div>')
    .replaceAll('<strong>牌靴 METRIX</strong><small>ADMIN CONTROL CENTER</small>','<strong>星準體育後台</strong><small>百家樂管理</small>')
    .replaceAll('<strong>星準管理後台</strong>','<strong>星準體育後台</strong>')
    .replaceAll('牌靴 METRIX','星準百家樂')
    .replaceAll('METRIX ADMIN','星準體育管理後台')
    .replace('<nav class="nav">','<nav class="nav"><a class="nav-item" href="/admin">返回體育後台</a><a class="nav-item" href="/admin/accounts">體育帳號管理</a>');
}
