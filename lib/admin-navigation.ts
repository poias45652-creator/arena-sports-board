import {leaguePageHref} from './sport-navigation';

export const baccaratSections={
  members:'會員授權', dashboard:'百家樂主控台', users:'百家樂會員資料',
  permissions:'百家樂模組權限', settings:'百家樂系統設定', logs:'操作紀錄',
} as const;
export type BaccaratSection=keyof typeof baccaratSections;
export function isBaccaratSection(value:string):value is BaccaratSection {
  return Object.hasOwn(baccaratSections,value);
}
export const adminLinks=[
  ...Object.entries(baccaratSections).map(([section,label])=>({href:'/admin/baccarat/'+section,label})),
  {href:'/admin',label:'體育系統設定'},
  {href:'/admin/leagues',label:'體育聯盟賽事'},
  {href:'/admin/regional-basketball',label:'澳韓籃球查核'},
  {href:'/admin/schedules',label:'排程管理'},
  {href:leaguePageHref('MLB'),label:'返回賽事'},
];
