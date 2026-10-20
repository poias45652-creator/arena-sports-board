/* Fictional domestic ladders; optional origin metadata never migrates existing clubs. */
(function(root){
'use strict';
const COUNTRIES=['台灣','日本','韓國','美國','西班牙'],DIRECT=85;
const CITIES={台灣:['台北','台中','高雄','台南','桃園','新竹','花蓮','嘉義'],日本:['東京','大阪','橫濱','名古屋','札幌','福岡','仙台','廣島'],韓國:['首爾','釜山','仁川','大邱','大田','光州','水原','昌原'],美國:['洛城','紐約','西雅圖','芝城','波城','休城','費城','聖城'],西班牙:['馬德里','巴塞隆納','塞維亞','瓦倫西亞','畢爾包','赫羅納','馬拉加','薩拉戈薩']};
const definitions=[
 [0,'台灣','home','台灣職棒',0,52],[0,'日本','japan','日本職棒',1,68],[0,'韓國','korea','韓國職棒',1,64],[0,'美國','usa','大聯盟層級',2,82],[0,'西班牙','spain-base','西班牙棒球聯賽',0,49],
 [1,'台灣','home','台灣足球聯賽',0,52],[1,'日本','japan','日本足球聯賽',1,61],[1,'韓國','korea','韓國足球聯賽',1,63],[1,'美國','usa','美國足球聯賽',1,64],[1,'西班牙','spain','西班牙頂級足球聯賽',2,77],
 [2,'台灣','home','台灣職籃',0,52],[2,'日本','japan','日本職籃',1,65],[2,'韓國','korea','韓國職籃',1,65],[2,'美國','usa','NBA 層級',2,82],[2,'西班牙','spain-basket','西班牙頂級籃球聯賽',2,76]
];
const LEAGUES=[];
for(const [sport,country,id,name,tier,power]of definitions){
 LEAGUES.push({sport,country,id,name,tier,power,division:1,teams:[]});
 if(tier>0)LEAGUES.push({sport,country,id:id+'-development',name:country+(sport===0?(country==='美國'?'小聯盟':'職棒二軍'):sport===1?'次級足球聯賽':country==='美國'?'發展籃球聯賽':'次級籃球聯賽'),tier:tier-1,power:power-20,division:2,teams:[]});
}
function ladders(sport,country){return LEAGUES.filter(l=>l.sport===sport&&l.country===country)}
function find(sport,id){return LEAGUES.find(l=>l.sport===sport&&l.id===id)}
function register(sport,clubs,footballLeagues){
 for(const l of LEAGUES.filter(l=>l.sport===sport)){
  let members=clubs.filter(c=>c.league===l.id);
  if(!members.length&&sport!==1&&['home','usa'].includes(l.id))members=clubs.filter(c=>!c.league&&c.tier===l.tier);
  if(!members.length){
   const suffix=l.division===2?['曙光','新翼','遠志','拓荒','晨風','追光','青峰','逐夢']:['星火','銀盾','飛翼','晨曦','烈風','海帆','天際','光城'];
   members=CITIES[l.country].map((city,i)=>({sport,name:city+suffix[i]+(l.division===2?'育成':sport===0?'棒球':sport===1?'競技':'籃球'),league:l.id,tier:l.tier,power:l.power+[-3,3,-1,2,0,-4,4,1][i],style:'balanced'}));
   clubs.push(...members);
  }
  for(const c of members){c.country=l.country;c.division=l.division;c.league=l.id}
  l.teams=members.map(c=>c.name);
  if(footballLeagues&&!footballLeagues.some(x=>x.id===l.id))footballLeagues.push({...l});
 }
}
function current(s,team=s.team){return LEAGUES.find(l=>l.sport===s.sport&&l.teams.includes(team))}
function entry(s,ability){const list=ladders(s.sport,COUNTRIES.includes(s.country)?s.country:'台灣'),top=list.find(l=>l.division===1);return ability>=DIRECT?top:list.find(l=>l.division===2)||top}
function start(s,ability){const l=entry(s,ability);let h=2166136261;for(const c of s.seed+'|start')h=Math.imul(h^c.charCodeAt(0),16777619);s.origin={v:1,country:l.country,league:l.id};s.team=l.teams[(h>>>0)%l.teams.length];s.tier=l.tier;s.yearsLeft=2;s.salary=Math.max(1,Math.round(ability**2*.2*[1,2.5,7][l.tier]));s.role=l.division===2?'育成新秀':'職業新秀';s.clubs[s.team]=0;return l}
function debut(s,ability){if(!s.origin||s.history.length||current(s)?.division!==2||ability<DIRECT)return false;start(s,ability);return true}
function validate(s){if(s.origin===undefined)return;const o=s.origin,l=find(s.sport,o?.league);if(!o||o.v!==1||!l||l.country!==o.country||o.country!==s.country)throw Error('起始國家與聯賽存檔格式不正確')}
const api={COUNTRIES,DIRECT,LEAGUES,find,ladders,register,current,entry,start,debut,validate};if(typeof module!=='undefined')module.exports=api;else root.XZOrigins=api;
})(globalThis);
