import {plain} from './baseball-live-providers.mjs';
const URL_BASE='https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx?sort=INN2_CN';
const TEAMS={LT:'樂天巨人',HH:'韓華鷹',HT:'起亞虎',OB:'斗山熊',NC:'NC 恐龍',KT:'KT 巫師',LG:'LG 雙子',SS:'三星獅',SK:'SSG 登陸者',WO:'培證英雄'};
const attr=(s,key)=>plain(s.match(new RegExp(`\\b${key}=(["'])([\\s\\S]*?)\\1`,'i'))?.[2]||'');
export function kboPageTargets(html){
 const out=new Map();for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const label=plain(m[2]),target=attr(m[1],'href').match(/__doPostBack\('([^']*\$ucPager\$btnNo\d+)'\s*,\s*''\)/)?.[1];
  if(target&&/^\d+$/.test(label))out.set(Number(label),target);
 }return out;
}
// Ordinary public ASP.NET statistics filters. State is kept only for this
// request sequence and is never logged, persisted or used for authentication.
export function kboPublicForm(html,teamCode,page=1){
 if(!TEAMS[teamCode]||!Number.isInteger(page)||page<1||page>5)throw Error('Invalid KBO statistics filter');
 const form=new URLSearchParams();
 for(const m of html.matchAll(/<input\b([^>]*)>/gi)){const name=attr(m[1],'name');if(name&&attr(m[1],'type')==='hidden')form.set(name,attr(m[1],'value'));}
 let teamField='';
 for(const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)){
  const name=attr(m[1],'name');if(!name)continue;
  const options=[...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)];
  const selected=options.find(o=>/\bselected(?:\s|=|$)/i.test(o[1]))||options[0];
  form.set(name,selected?attr(selected[1],'value'):'');
  if(name.endsWith('$ddlTeam')){teamField=name;if(!options.some(o=>attr(o[1],'value')===teamCode))throw Error('KBO team filter missing');form.set(name,teamCode);}
 }
 if(!teamField||!form.has('__VIEWSTATE')||!form.has('__EVENTVALIDATION'))throw Error('KBO public statistics form changed');
 const pageField=[...form.keys()].find(k=>k.endsWith('$hfPage'));
 if(!pageField)throw Error('KBO page field missing');
 form.set(pageField,String(page));
 const order=[...form.keys()].find(k=>k.endsWith('$hfOrderByCol'));if(order)form.set(order,'INN2_CN');
 const event=page===1?teamField:kboPageTargets(html).get(page);if(!event)throw Error('KBO next page link missing');
 form.set('__EVENTTARGET',event);form.set('__EVENTARGUMENT','');
 return form;
}
export function createKboSeasonPages({fetcher=fetch,now=Date.now,parse}){
 const cache=new Map(),pending=new Map();
 return async function collect(date,teams=[]){
  const codes=Object.keys(TEAMS).filter(c=>!teams.length||teams.includes(TEAMS[c]));
  const key=date+':'+codes.sort().join(',');const cached=cache.get(key);if(cached?.until>now())return cached.value;if(pending.has(key))return pending.get(key);
  const task=(async()=>{
   const deadline=AbortSignal.timeout(25000),results=[];let cookie='';
   const read=async(body)=>{
    const r=await fetcher(URL_BASE,{method:body?'POST':'GET',...(body?{body:body.toString()}:{}),redirect:'manual',cache:'no-store',headers:{'User-Agent':'YJBaseballStats/1.0',Accept:'text/html',...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},signal:AbortSignal.any([deadline,AbortSignal.timeout(9000)])});
    if(!r.ok){await r.body?.cancel();let target='';if(r.status>=300&&r.status<400&&r.headers.get('location'))target=' → '+new URL(r.headers.get('location'),URL_BASE).pathname;throw Error('HTTP '+r.status+target);}
    if(!body)cookie=(r.headers.getSetCookie?.()||[]).map(s=>s.split(';')[0]).join('; ');
    let size=0;const chunks=[];for await(const part of r.body){size+=part.byteLength;if(size>4_000_000)throw Error('來源內容超出上限');chunks.push(part);}
    const html=Buffer.concat(chunks).toString('utf8');if(/challenge-platform|<title>Just a moment/i.test(html))throw Error('來源要求瀏覽器驗證');return html;
   };
   let first;try{first=await read();}catch(e){return {rows:[],sources:[],errors:['KBO 官方投手紀錄：'+e.message],scope:'官方全投手名單；未取得者保留缺值'};}
   // Three team filters at a time; read a second page when the team has >30
   // pitchers. This includes pitchers excluded by the qualified-ERA ranking.
   for(let offset=0;offset<codes.length;offset+=3)await Promise.all(codes.slice(offset,offset+3).map(async code=>{
    const url=URL_BASE+'#team='+code;const rows=[];let observedAt=null,error=null;
    try{
     let html=await read(kboPublicForm(first,code));
     for(let page=1;page<=5;page++){
      observedAt=new Date(now()).toISOString();const parsed=parse(html,date,observedAt,url+'&page='+page);
      if(!parsed.length||parsed.some(r=>r.team!==TEAMS[code]))throw Error('韓職球隊篩選未生效');
      rows.push(...parsed);
      if(!kboPageTargets(html).has(page+1))break;
      if(page===5)throw Error('韓職投手分頁超出上限');
      html=await read(kboPublicForm(html,code,page+1));
     }
    }catch(e){error=`KBO ${code}：${e.name==='TimeoutError'||e.name==='AbortError'?'讀取逾時':e.message}`;}
    results.push({url,rows,observedAt,error});
   }));
   const unique=new Map();for(const r of results)for(const row of r.rows)unique.set(row.team+':'+row.name,row);
   return {rows:[...unique.values()],sources:results.map(({rows,...r})=>({...r,rows:rows.length})),errors:results.flatMap(r=>r.error?[r.error]:[]),scope:'依官方球隊篩選補入全部投手；牛棚未以全隊投手總數冒充'};
  })().then(value=>{if(cache.size>12)cache.clear();cache.set(key,{value,until:now()+(value.errors.length?60000:900000)});return value;}).finally(()=>pending.delete(key));
  pending.set(key,task);return task;
 };
}
