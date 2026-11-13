import {leaguePageHref} from './sport-navigation';

export const adminHome='/admin/baccarat/members';

export const baccaratSections={
  members:'會員管理', dashboard:'百家樂主控台',
  permissions:'百家樂模組權限', settings:'百家樂系統設定', logs:'操作紀錄',
} as const;
export type BaccaratSection=keyof typeof baccaratSections;
export function isBaccaratSection(value:string):value is BaccaratSection {
  return Object.hasOwn(baccaratSections,value);
}
export const adminLinks=[
  ...Object.entries(baccaratSections).map(([section,label])=>({href:'/admin/baccarat/'+section,label})),
  {href:'/admin/system',label:'體育系統設定'},
  {href:'/admin/leagues',label:'體育聯盟賽事'},
  {href:'/admin/regional-basketball',label:'澳韓籃球查核'},
  {href:'/admin/schedules',label:'排程管理'},
  {href:leaguePageHref('MLB'),label:'返回賽事'},
];

export function loginLandingPage(
  query: URLSearchParams,
  session: { source?: string; isAdmin?: boolean; platforms?: boolean },
): string | null {
  const adminTarget = query.get('admin');
  if (adminTarget !== null) {
    if (session.isAdmin !== true) return '/platforms';
    return /^\/admin(?:\/(?:accounts|leagues|regional-basketball|schedules|system|baccarat\/(?:members|settings|permissions|users|dashboard|logs)))$/.test(adminTarget) ? adminTarget : adminHome;
  }
  if (session.source === 'ofa' && session.isAdmin === true && query.get('portal') !== '1') return adminHome;
  if (session.platforms || query.get('portal') === '1' || !query.has('basketball')) return '/platforms';
  return null;
}
