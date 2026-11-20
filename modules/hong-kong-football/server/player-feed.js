import {players} from './records.js';
// Public, completed-match HKPL Fantasy statistics. No upstream code is executed.
const host='https://hkfpl.com.hk';
const clubs={
  ND:['golik-north','高力北區'],LM:['lee-man','理文'],KC:['kitchee','傑志'],TP:['tai-po','大埔'],
  SO:['kc-southern','冠忠南區'],ED:['eastern-district','東區'],HK:['hkfc','港會'],ST:['shatin','至尊沙田'],
  KL:['kowloon-city','和富九龍城'],BR:['bc-rangers','標準流浪'],EA:['eastern','東方']
};
const clubNames=new Set(Object.values(clubs).map(c=>c[1]));
const invalid=()=>new Error('港超本季球員統計暫時無法核實');
const clean=s=>String(s??'').replace(/<!--[\s\S]*?-->|<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#x27;|&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;|\s+/g,' ').trim();
function numeric(raw,limit=2500){
  const s=clean(raw);
  const n=/^\d{1,4}$/.test(s)?Number(s):NaN;
  if(!Number.isInteger(n)||n>limit)throw invalid();
  return n;
}
const maybeZero=raw=>/^[–—-]$/.test(clean(raw))?0:numeric(raw,30);
function hrefPlayer(url,id){
  const m=/^https:\/\/hkfpl\.com\.hk\/players\/(\d{1,10})(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$/.exec(url);
  if(!m||m[1]!==String(id))throw invalid();
  return url;
}
function parseDoc(html,type,url,team){
  if(typeof html!=='string'||html.length>2500000||!clubs[team])throw invalid();
  const title=clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  if(!title.includes('2026/27'))throw invalid();
  const docs=Array.from(html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),m=>JSON.parse(m[1]));
  const entity=docs.find(d=>d?.['@type']===type&&d.url===url);
  const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if(!entity||!main)throw invalid();
  return {main,entity};
}
function dateOf(raw){
  const stamp=raw.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1];
  if(!stamp||!/(Z|[+-]\d{2}:\d{2})$/.test(stamp))throw invalid();
  const epoch=Date.parse(stamp);
  if(!Number.isFinite(epoch))throw invalid();
  const day=new Date(epoch+8*3600000).toISOString().slice(0,10);
  if(day<'2026-07-01'||day>='2027-07-01')throw invalid();
  return day;
}
function venueOf(raw){
  const v=raw.match(/<abbr\b[^>]*title="(主場|作客)"[^>]*>/)?.[1];
  if(!v)throw invalid();
  return v==='作客'?'客場':v;
}
function resultOf(score){
  const m=/^(\d{1,2})\s*[–—-]\s*(\d{1,2})$/.exec(score);
  if(!m)throw invalid();
  return {score:m[1]+'–'+m[2],result:+m[1]>+m[2]?'勝':+m[1]===+m[2]?'和':'負'};
}
function rows(table){
  return Array.from(table.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi),m=>Array.from(m[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi),r=>r[1])).flat();
}
function subTable(main,caption){
  return Array.from(main.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi),m=>m[1]).find(t=>clean(t.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i)?.[1])===caption);
}
export function parseClubRoster(html,team){
  const club=clubs[team];if(!club)throw invalid();
  const url=host+'/clubs/'+club[0],{main,entity}=parseDoc(html,'SportsTeam',url,team);
  if(entity['@id']!==url+'#team'||!entity.alternateName?.includes(club[1])||entity.memberOf?.['@id']!==host+'/#hkpl')throw invalid();
  const table=subTable(main,club[1]+' 本季上陣球員');if(!table)throw invalid();
  const people=new Map();
  let position=null;
  for(const row of rows(table)){
    if(row.includes('scope="rowgroup"')){
      position=clean(row);
      if(!['門將','後衛','中場','前鋒'].includes(position))throw invalid();
      continue;
    }
    const a=row.match(/<a\b[^>]*href="(\/players\/(\d{1,10})(?:-[a-z0-9-]+)?)"[^>]*>([\s\S]*?)<\/a>/i);
    const cells=Array.from(row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),m=>m[1]);
    if(!a||!position||cells.length<2||people.has(a[2]))throw invalid();
    const name=clean(a[3]),en=clean(row.match(/<\/a>\s*<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    if(!name)throw invalid();
    people.set(a[2],{id:a[2],team,name,en,position,url:hrefPlayer(host+a[1],a[2]),appearances:numeric(cells[0],30),minutes:numeric(cells[1])});
  }
  // The lists only prove the explicitly listed totals; absence is not zero.
  for(const m of main.matchAll(/<h2\b[^>]*>(入球|助攻|門將零失球)<\/h2>\s*<ol\b[^>]*>([\s\S]*?)<\/ol>/g)){
    const key={'入球':'goals','助攻':'assists','門將零失球':'cleanSheets'}[m[1]];
    for(const [,li] of m[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)){
      const id=li.match(/<a\b[^>]*href="\/players\/(\d+)(?:-[a-z0-9-]+)?"/)?.[1];
      const total=li.match(/<\/a>\s*<\/span>\s*<span\b[^>]*>(\d+)<\/span>/)?.[1];
      if(id&&total!=null&&people.has(id))people.get(id)[key]=numeric(total,60);
    }
  }
  const results=[],section=main.match(/<h2\b[^>]*>賽果<\/h2>([\s\S]*?)<\/section>/i)?.[1];
  const total=clean(main.match(/<p\b[^>]*>[^<]*?香港超級聯賽 2026\/27 球季已賽\s*(\d+)\s*場/i)?.[1]);
  if(!section||!/^\d+$/.test(total))throw invalid();
  for(const [,li] of section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)){
    const opponent=clean(li.match(/<a\b[^>]*href="\/clubs\/[a-z-]+"[^>]*>([\s\S]*?)<\/a>/i)?.[1]);
    const score=clean(li.match(/<span\b[^>]*>\s*(\d{1,2}\s*[–—-]\s*\d{1,2})\s*<\/span>/)?.[1]);
    if(!clubNames.has(opponent))throw invalid();
    results.push({date:dateOf(li),opponent,venue:venueOf(li),...resultOf(score)});
  }
  if(results.length!==Number(total)||new Set(results.map(g=>g.date)).size!==results.length)throw invalid();
  return {team,season:2026,players:[...people.values()],results};
}
export function parsePlayerStats(html,{id,team,url}){
  hrefPlayer(url,id);
  const {main,entity}=parseDoc(html,'Person',url,team),club=clubs[team];
  if(entity['@id']!==url+'#person'||entity.memberOf?.['@id']!==host+'/clubs/'+club[0]+'#team')throw invalid();
  const name=clean(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  if(!name||!(entity.name===name||entity.alternateName?.includes(name)))throw invalid();
  const fields=new Map();
  for(const [,key,v] of main.matchAll(/<dt\b[^>]*>([^<]+)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi))fields.set(clean(key),clean(v));
  const appearances=numeric(fields.get('上陣'),30),minutes=numeric(fields.get('分鐘')),goals=numeric(fields.get('入球'),80),assists=numeric(fields.get('助攻'),80);
  const [yc,rc]=fields.has('黃牌／紅牌')?fields.get('黃牌／紅牌').split('/'):['黃牌','紅牌'].map(k=>fields.get(k));
  const yellow=numeric(yc,50),red=numeric(rc,30),cleanSheets=fields.has('零失球')?numeric(fields.get('零失球'),30):null;
  const table=subTable(main,name+' 2026/27 每場數據'),games=[];
  if(appearances>0&&!table)throw invalid();
  if(table)for(const row of rows(table)){
    const cells=Array.from(row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),m=>m[1]);
    const opponent=clean(row.match(/<span\b[^>]*class="hidden sm:inline"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
    if(!clubNames.has(opponent)||cells.length!==(cleanSheets==null?5:6))throw invalid();
    const game={opponent,venue:venueOf(row),date:dateOf(row),...resultOf(clean(cells[0])),minutes:numeric(cells[1],130),goals:maybeZero(cells[2]),assists:maybeZero(cells[3])};
    const discipline=cells.at(-1),labels=Array.from(discipline.matchAll(/aria-label="([^"]+)"/g),m=>m[1]);
    if(labels.length?labels.every(k=>k==='黃牌'||k==='紅牌'):/^[–—-]$/.test(clean(discipline))){
      game.yellow=labels.filter(k=>k==='黃牌').length;
      game.red=labels.filter(k=>k==='紅牌').length;
    }
    if(cleanSheets!=null){
      if(/aria-label="零失球"/.test(cells[4]))game.cleanSheet=true;
      else if(/^[–—-]$/.test(clean(cells[4])))game.cleanSheet=false;
    }
    games.push(game);
  }
  const sum=field=>games.reduce((n,g)=>n+g[field],0);
  if(games.length!==appearances||sum('minutes')!==minutes||sum('goals')!==goals||sum('assists')!==assists||new Set(games.map(g=>g.date)).size!==games.length)throw invalid();
  for(const [key,total] of [['yellow',yellow],['red',red],['cleanSheet',cleanSheets]]){
    if(total==null||!games.every(g=>g[key]!=null)||sum(key)!==total)for(const g of games)delete g[key];
  }
  return {id:String(id),team,season:2026,appearances,minutes,goals,assists,yellow,red,cleanSheets,games:games.sort((a,b)=>b.date.localeCompare(a.date))};
}
export function mergePlayerStats(base,club,person){
  if(!club||!person||String(base.id)!==person.id||base.team!==person.team||club.team!==base.team)throw invalid();
  const listed=club.players.find(p=>p.id===person.id);
  if(!listed||listed.appearances!==person.appearances||listed.minutes!==person.minutes)throw invalid();
  const signature=g=>[g.date,g.venue,g.opponent,g.score].join('|');
  const fixtures=new Set(club.results.map(signature));
  if(!person.games.every(g=>fixtures.has(signature(g))))throw invalid();
  const prior=new Map((base.games||[]).map(g=>[signature(g),g]));
  const games=person.games.map(g=>({...g,started:prior.get(signature(g))?.started??null}));
  const startCount=games.every(g=>typeof g.started==='boolean')?games.filter(g=>g.started).length:null;
  return {...base,...person,games,startCount};
}
const cache=new Map();
async function readPage(url,parse,siteOrigin,ttl=300000,timeout=9500){
  const now=Date.now(),old=cache.get(url);
  if(old&&old.until>now){if(old.value)return old.value;throw invalid();}
  if(old?.pending)return old.pending;
  const pending=(async()=>{
    const edge=globalThis.caches?.default;
    const key=siteOrigin?new URL('/.hkpl-cache/player-feed-v1'+new URL(url).pathname+new URL(url).search,siteOrigin).href:null;
    let fallback=old?.value;
    try{
      if(edge&&key&&!fallback){
        try{
          const stored=await edge.match(key);
          if(stored){const value=await stored.json();if(value?.season===2026&&Number.isFinite(Date.parse(value.checkedAt)))fallback=value;}
        }catch{}
      }
      if(fallback&&now-Date.parse(fallback.checkedAt)<ttl){
        cache.set(url,{value:fallback,until:Date.parse(fallback.checkedAt)+ttl});return fallback;
      }
      const res=await fetch(url,{headers:{accept:'text/html','accept-language':'zh-HK'},signal:AbortSignal.timeout(timeout),redirect:'manual'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      const value={...parse(await res.text()),checkedAt:new Date().toISOString()};
      cache.set(url,{value,until:now+ttl});
      if(edge&&key)try{await edge.put(key,Response.json(value,{headers:{'Cache-Control':'public,max-age=86400'}}));}catch{}
      return value;
    }catch{
      cache.set(url,{value:fallback,until:now+60000});
      if(fallback)return fallback;throw invalid();
    }
  })();
  cache.set(url,{...old,pending});
  return pending;
}
export function getClubRoster(team,siteOrigin){
  if(!Object.hasOwn(clubs,team))throw invalid();
  return readPage(host+'/clubs/'+clubs[team][0],html=>parseClubRoster(html,team),siteOrigin);
}
export function getPlayerStats(player,siteOrigin){
  const url=hrefPlayer(player.url,player.id);
  return readPage(url,html=>parsePlayerStats(html,player),siteOrigin).then(p=>{if(p.team!==player.team||p.id!==String(player.id))throw invalid();return p;});
}

export async function currentPlayerFeed(base,id,team,siteOrigin){
  if(!Object.hasOwn(clubs,team)||!/^\d{1,10}$/.test(id||''))return null;
  const clubRequest=getClubRoster(team,siteOrigin);
  if(base?.url?.startsWith(host+'/players/')){
    const [club,detail]=await Promise.all([clubRequest,getPlayerStats(base,siteOrigin)]);
    const player=mergePlayerStats(base,club,detail);
    return {club,player};
  }
  const club=await clubRequest;
  const entry=club.players.find(p=>p.id===id);
  if(!entry)return {club};
  const detail=await getPlayerStats(entry,siteOrigin);
  // A debut can reach the published league statistics before the local squad snapshot.
  return {club,player:mergePlayerStats({...base,...entry,team,season:2026},club,detail)};
}

const faClubIds={LM:320,ND:47,KC:4,TP:21,SO:50,ED:44,HK:15,ST:48,KL:45,BR:3,EA:12};
const missingPortraits=new Map(players.filter(p=>!p.photo&&p.hkfaLid).map(p=>[String(p.id),p]));

export function parseClubPortraits(html,team){
  if(!Object.hasOwn(faClubIds,team)||html.length>2500000)throw invalid();
  // Read literal data from the public roster. The shared logo is usually a JS variable.
  const rows=/leagueyearteamplayer_id:(\d+),Player:\{PlayerImage:("(?:[^"\\]|\\.)*"|[\w$]+),PlayerName:("(?:[^"\\]|\\.)*"|[\w$]+),player_position:[^,{}]+,player_id:(\d+)/g;
  const photos={};
  let registrations=0;
  for(const [,lid,rawImage,rawName,id] of html.matchAll(rows)){
    registrations++;
    const p=missingPortraits.get(id);
    if(!p||p.team!==team||String(p.hkfaLid)!==lid||!rawName.startsWith('"')||!rawImage.startsWith('"'))continue;
    if(![p.officialName,p.name].includes(JSON.parse(rawName)))continue;
    const href=JSON.parse(rawImage);
    if(!URL.canParse(href))continue;
    const url=new URL(href);
    if(url.origin!=='https://resource.hkfa.com'||url.username||url.password||!/^\/var\/images\/.+\.(jpg|jpeg|webp|png)$/i.test(url.pathname)||/logo|default|placeholder|silhouette|no[_-]?photo/i.test(url.pathname))continue;
    photos[id]=url.href;
  }
  if(!registrations)throw invalid();
  return {team,season:2026,photos};
}

export async function getClubPortraits(team,siteOrigin){
  if(!Object.hasOwn(faClubIds,team))return null;
  const url='https://www.hkfa.com/hkpl/squad?clubid='+faClubIds[team];
  const result=await readPage(url,html=>parseClubPortraits(html,team),siteOrigin,12*60*60000,3000);
  return result.team===team?result.photos:null;
}
