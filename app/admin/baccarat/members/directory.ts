import type {Account} from '../../accounts';

export type BaccaratGrant = {enabled:boolean; expiresAt:number|null};
export type PlatformMember = {username:string; baccarat?:BaccaratGrant};
export type Member = {username:string; sports:Account[]; baccarat?:BaccaratGrant};
export type Filter = 'all'|'pending'|'active'|'inactive';

export function memberDirectory(sports:Account[], platform:PlatformMember[]) {
  const members = new Map<string,Member>();
  function get(username:string) {
    const key = username.toLowerCase();
    let member = members.get(key);
    if (!member) {
      member = {username,sports:[]};
      members.set(key,member);
    }
    return member;
  }
  for (const row of platform) if (row.baccarat) get(row.username).baccarat = row.baccarat;
  for (const account of sports) get(account.username).sports.push(account);
  return [...members.values()].sort((a,b)=>a.username.localeCompare(b.username,'zh-TW',{numeric:true}));
}

export const sportsLabels = {pending:'待授權',active:'已開通',disabled:'已停用',expired:'已到期'} as const;
export function baccaratStatus(grant?:BaccaratGrant) {
  if (!grant) return '未開通';
  if (!grant.enabled) return '已停用';
  return grant.expiresAt!==null && grant.expiresAt<=Date.now() ? '已到期' : '已開通';
}
export function matchesFilter(member:Member,filter:Filter) {
  return filter==='all'||member.sports.some(({accessState})=>filter==='inactive'?
    accessState==='disabled'||accessState==='expired':accessState===filter);
}
