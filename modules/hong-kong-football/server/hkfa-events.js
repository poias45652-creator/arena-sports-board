import {officialState} from './hkfa-scoreboard.js';
const clubs = {'東方':'EA','至尊沙田':'ST','冠忠南區':'SO','港會':'HK','標準流浪':'BR','傑志':'KC','高力北區':'ND','大埔':'TP','理文':'LM','和富九龍城':'KL','東區':'ED'};
const bad=()=>new Error('足總賽事明細目前無法核實');
const integer=value=>typeof value==='number'&&Number.isInteger(value)&&value>=0?value:typeof value==='string'&&/^\d{1,8}$/.test(value)?Number(value):null;
const safeKey=key=>!['__proto__','prototype','constructor','length'].includes(key);
const word=/[A-Za-z_$][\w$]*/y, number=/-?\d+(?:\.\d+)?/y, string=/"(?:[^"\\]|\\.)*"/y;

// Read data literals and named references from a serialized match sheet.
// No calls, property traversal, script evaluation or other expressions are supported.
function reader(text,refs){
  let pos=0;
  function token(re){re.lastIndex=pos;const hit=re.exec(text);if(!hit)throw bad();pos=re.lastIndex;return hit[0];}
  function expect(char){if(text[pos++]!==char)throw bad();}
  function val(depth=0){
    if(depth>35)throw bad();
    const ch=text[pos];
    if(ch==='"')return JSON.parse(token(string));
    if(ch==='-' || (ch>='0'&&ch<='9'))return Number(token(number));
    if(ch==='{'){
      pos++;const object=Object.create(null);
      if(text[pos]!=='}')for(;;){
        const key=text[pos]==='"'?JSON.parse(token(string)):token(word);
        if(!safeKey(key))throw bad();
        expect(':');object[key]=val(depth+1);if(text[pos]!==',')break;pos++;
      }
      expect('}');return object;
    }
    if(ch==='['){
      pos++;const array=[];
      if(text[pos]!==']')for(;;){array.push(val(depth+1));if(text[pos]!==',')break;pos++;}
      expect(']');return array;
    }
    const id=token(word);
    if(id==='null')return null;
    if(id==='false'||id==='true')return id==='true';
    if(id==='Array'){expect('(');const size=Number(token(number));expect(')');if(!Number.isInteger(size)||size<0||size>1000)throw bad();return new Array(size);}
    if(!refs.has(id))throw bad();
    return refs.get(id);
  }
  function assignments(){
    while(pos<text.length){
      const dst=refs.get(token(word));if(!dst||typeof dst!=='object')throw bad();
      let index;
      if(text[pos]==='['){pos++;index=Number(token(number));expect(']');if(!Array.isArray(dst)||index<0||index>=dst.length||!Number.isInteger(index))throw bad();}
      else{expect('.');index=token(word);if(!safeKey(index)||Array.isArray(dst))throw bad();}
      expect('=');dst[index]=val();expect(';');
    }
  }
  return {val,expect,assignments};
}
function matchSheet(html){
  if(typeof html!=='string'||html.length>2000000)throw bad();
  const compact=html.match(/<script\b[^>]*>\s*window\.__NUXT__\s*=\s*([\s\S]*?)<\/script>/i)?.[1];
  if(!compact)throw bad();
  const header=compact.match(/^\(function\(([^)]*)\)\{/);
  const argsPos=compact.lastIndexOf('}}(');
  if(!header||argsPos<0)throw bad();
  const names=header[1].split(','),refs=new Map();
  const args=reader(compact.slice(argsPos+3),new Map());
  for(let i=0;i<names.length;i++){if(i)args.expect(',');refs.set(names[i],args.val());}
  args.expect(')');
  const start=compact.indexOf('return {layout:');
  if(start<header[0].length)throw bad();
  reader(compact.slice(header[0].length,start),refs).assignments();
  const marker='data:[{MatchData:';
  const pos=compact.indexOf(marker,start);
  if(pos===-1)throw bad();
  return reader(compact.slice(pos+marker.length),refs).val();
}

const positions={GK:'門將',DF:'後衛',MF:'中場',FW:'前鋒'};
export function parseHkfaEvents(html,expected={}){
  const data=matchSheet(html);
  const home=clubs[data.team_home?.TeamName],away=clubs[data.team_guest?.TeamName];
  const id=integer(data.match_id);
  if(!id||!home||!away||home===away||!String(data.LeagueYear?.LeagueYearName).includes('香港超級聯賽')||
    expected.id!=null&&Number(expected.id)!==id||expected.home&&expected.home!==home||expected.away&&expected.away!==away||
    expected.dateISO&&expected.dateISO!==data.match_date)throw bad();
  const lineups={},index=new Map();
  for(const [team,side] of [[home,'Home'],[away,'Guest']]){
    const players=[];
    for(const [starter,key] of [[true,side+'Players'],[false,side+'SubPlayers']]){
      if(!Array.isArray(data[key]))continue;
      for(const person of data[key]){
        const p=person?.Player;const pid=integer(person?.player_id),lid=integer(person?.leagueyearteamplayer_id);
        if(!pid||!lid||!p||typeof p.PlayerName!=='string'||!p.PlayerName.trim()||index.has(team+'-'+pid))throw bad();
        const player={hkfaId:String(pid),hkfaLid:String(lid),url:'https://www.hkfa.com/hkpl/squad/player/detail?id='+pid+'&lid='+lid,
          number:integer(person.player_jersey),name:p.PlayerName.trim(),position:positions[p.player_position]||null,captain:person.captain===true,starter};
        index.set(team+'-'+pid,player);players.push(player);
      }
    }
    if(players.length)lineups[team]=players;
  }
  const state=officialState(String(data.matchStatus||''),data.match_status);
  const confirmed=state==='live'||state==='final';
  const hasEvents=confirmed&&Array.isArray(data.MatchEvents);
  const events={goals:[],cards:[],substitutions:[]};
  for(const e of (hasEvents?data.MatchEvents:[])){
    const type=e?.EventType;
    const side=e?.side==='Home'?'home':e?.side==='Guest'?'guest':null;
    if(!side)continue;
    const isHome=side==='home',team=isHome?home:away;
    const min=String(e.min??'');if(!/^(?:\d{1,3}|HT|BM|AM|EHT|BET|EAM)$/.test(min))continue;
    const extra=integer(e.minExtra);
    const minute=min+(extra?'+'+extra:'');
    const inId=integer(e['teamplayer_'+side]?.player_id);
    const who=index.get(team+'-'+inId);
    if(!who)continue;
    const person={hkfaId:who.hkfaId,hkfaLid:who.hkfaLid,url:who.url,name:who.name,team,minute};
    if(type==='EXC'){
      const other=index.get(team+'-'+integer(e['teamplayer_'+side+'_sub']?.player_id));if(!other)continue;
      events.substitutions.push({team,minute,name:who.name,type:'substitution',in:who.name,out:other.name,inId:who.hkfaId,outId:other.hkfaId,url:who.url});
    }else if(['G','PEN','OG'].includes(type)){
      const own=type==='OG';
      events.goals.push({...person,type:'goal',...(type==='PEN'?{penalty:true}:{}),...(own?{ownGoal:true,team:isHome?away:home,playerTeam:team}:{})});
    }else if(['RC','YC','2YC','YRC','Y2C'].includes(type)){
      events.cards.push({...person,type:type==='RC'?'red':type==='YC'?'yellow':'secondYellow'});
    }
  }
  const stats=[];
  for(const [field,label] of [['shoot','射門'],['shoot_on_target','射正'],['corner','角球'],['offside','越位'],['fouls','犯規'],['saves','撲救']]){
    const h=integer(data['home_'+field]),a=integer(data['guest_'+field]);
    if(confirmed&&h!=null&&a!=null)stats.push({label,home:h,away:a});
  }
  const attendance=integer(data.match_attendance);
  const match=confirmed?{state,status:data.matchStatus,homeScore:integer(data.home_score),awayScore:integer(data.guest_score)}:null;
  return {match,url:'https://www.hkfa.com/competitions/result/'+id+'/detail',venue:data.Venue?.VenueName||'',attendance:confirmed&&attendance>0?attendance:null,lineups,stats,
    ...Object.fromEntries(Object.entries(events).map(([k,v])=>[k,hasEvents?v:null]))};
}
export async function fetchHkfaEvents(expected,{fetcher=fetch,signal}={}){
  const id=integer(expected.id);if(!id)throw bad();
  const response=await fetcher('https://www.hkfa.com/competitions/result/'+id+'/detail',{headers:{Accept:'text/html','Accept-Language':'zh-HK'},signal});
  if(!response.ok)throw bad();return parseHkfaEvents(await response.text(),expected);
}

const detailCache=new Map();
export async function recentOfficialDetail(game, now){
  if(!game?.officialId||game.sourceKey||game.state==='cancelled'||Date.parse(game.start)-now>3*3600000)return null;
  const key=game.officialId+'-'+game.day,prev=detailCache.get(key);
  if(prev?.pending)return prev.pending;
  if(prev?.until>now)return prev.data;
  const pending=(async()=>{
    try{
      const data=await fetchHkfaEvents({id:game.officialId,home:game.home.id,away:game.away.id,dateISO:game.day},{signal:AbortSignal.timeout(6500)});
      data.checkedAt=new Date(now).toISOString();
      const complete=game.state==='final'&&Array.isArray(data.goals)&&data.goals.length===game.homeScore+game.awayScore&&Object.keys(data.lineups||{}).length===2;
      detailCache.set(key,{data,until:now+(complete?3600000:45000)});
      return data;
    }catch{
      const data=prev?.data||null;detailCache.set(key,{data,until:now+30000});return data;
    }
  })();
  detailCache.set(key,{pending,data:prev?.data});
  return pending;
}
