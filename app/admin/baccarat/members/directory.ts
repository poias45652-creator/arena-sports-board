import type {Account} from '../../accounts';

export type BaccaratGrant = {enabled:boolean; expiresAt:number|null};
export type BaccaratProfile = {
  id:string|number; tz_account:string; display_name:string|null; notes:string|null;
  status:'active'|'suspended'; created_at:string; expires_at:string|null;
  last_login_at:string|null; is_online:boolean; agent_group_id:string|number|null;
};
export type AgentGroup = {id:string|number;name:string};
export type Member = {username:string; sports:Account[]; profiles:BaccaratProfile[]};
export type Filter = 'all'|'pending'|'active'|'inactive'|'table'|'normal'|'suspended'|'expired'|'online';

export function memberDirectory(sports:Account[], profiles:BaccaratProfile[]) {
  const members=new Map<string,Member>();
  function get(username:string) {
    const key=username.toLowerCase();
    let member=members.get(key);
    if(!member){member={username,sports:[],profiles:[]};members.set(key,member);}
    return member;
  }
  for(const profile of profiles)get(profile.tz_account).profiles.push(profile);
  for(const account of sports)get(account.username).sports.push(account);
  return [...members.values()].sort((a,b)=>a.username.localeCompare(b.username,'zh-TW',{numeric:true}));
}
export function profileGrant(profile:BaccaratProfile):BaccaratGrant {
  return {enabled:profile.status==='active',expiresAt:profile.expires_at?Date.parse(profile.expires_at):null};
}
export const sportsLabels={pending:'待授權',active:'已開通',disabled:'已停用',expired:'已到期'} as const;
export function baccaratStatus(grant?:BaccaratGrant) {
  if (!grant) return '未開通';
  if (!grant.enabled) return '已停用';
  return grant.expiresAt!==null && grant.expiresAt<=Date.now() ? '已到期' : '已開通';
}
export function isSportsFilter(filter:Filter) {return filter==='active'||filter==='pending'||filter==='inactive';}
export function matchesFilter(member:Member,filter:Filter) {
  if(filter==='all')return true;
  if(isSportsFilter(filter))return member.sports.some(({accessState})=>filter==='inactive'?
    accessState==='disabled'||accessState==='expired':accessState===filter);
  return member.profiles.some(p=>{
    if(filter==='table')return true;
    if(filter==='online')return p.is_online;
    if(filter==='suspended')return p.status==='suspended';
    if(filter==='expired')return p.expires_at!==null&&Date.parse(p.expires_at)<=Date.now();
    return baccaratStatus(profileGrant(p))==='已開通';
  });
}
export function matchesSearch(member:Member,query:string) {
  return [member.username,...member.sports.map(a=>a.note),...member.profiles.flatMap(p=>[p.display_name,p.notes])]
    .some(value=>value?.toLowerCase().includes(query));
}
