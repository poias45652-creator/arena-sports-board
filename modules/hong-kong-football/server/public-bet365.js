import {aliases,normalized} from './bet365-es.js';

export const origin='https://www.totalcorner.com';
export const leagueUrl=origin+'/league/view/295';
const textOnly=s=>s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const nameOf=(source,side,listing)=>listing
  ? source.match(new RegExp('<td[^>]*class="[^"]*league-'+side+'[^"]*"[^>]*>\\s*<a[^>]*>([^<]+)</a>','i'))?.[1]
  : source.match(new RegExp('<div class="cs-mh-team cs-mh-'+side+'">\\s*<a[^>]*>([^<]+)</a>','i'))?.[1];
const localNames=new Map(Object.entries({
  '理文FC':'LM','北區':'ND','大埔':'TP','傑志':'KC','南區':'SO','香港流浪足球會':'BR',
  '沙田':'ST','東方足球隊':'EA','香港FC':'HK','東區':'ED','九龍城':'KL'
}));
function sideId(name){
  if(!name)return;
  if(/[^\x00-\x7F]/.test(name))return localNames.get(name.trim());
  const key=normalized(name);
  return key&&Object.keys(aliases).find(id=>aliases[id].some(alias=>normalized(alias)===key));
}
const hongKongOdds=value=>Math.round((value-1)*1000)/1000;
const validOdds=s=>/^\d+(?:\.\d+)?$/.test(s)&&Number(s)>1&&Number(s)<1000;

export function publicEvents(html){
  const events=[];
  for(const [,row] of html.matchAll(/<tr\b[^>]*class="league-match-row"[^>]*>([\s\S]*?)<\/tr>/g)){
    const status=row.match(/<td[^>]*class="[^"]*league-status[^"]*"[^>]*>([\s\S]*?)<\/td>/)?.[1];
    if(status==null||textOnly(status))continue;
    const path=row.match(/href="\/(?:zh-tw\/)?odds\/([a-z0-9-]+\/\d+)"/)?.[1];
    const home=sideId(nameOf(row,'home',true)),away=sideId(nameOf(row,'away',true));
    if(home&&away&&path)events.push({home,away,url:origin+'/euro-asian/'+path});
  }
  return events;
}
export function readPublicQuote(html,fixture,sourceUrl,checkedAt){
  const kickoff=Number(html.match(/class="cs-mh-time cs-mh-countdown"\s+data-ko="(\d{10})"/)?.[1])*1000;
  if(kickoff!==fixture.kickoff||kickoff<=Date.parse(checkedAt)||!/href="\/(?:zh-tw\/)?league\/view\/295"/.test(html))return null;
  if(sideId(nameOf(html,'home',false))!==fixture.home||sideId(nameOf(html,'away',false))!==fixture.away)return null;
  if(!/<a\s+class="active"\s+href="\?phase=close"[^>]*>(?:Closing|終盤)<\/a>/i.test(html))return null;
  const cards=[...html.matchAll(/<section class="ea-card">([\s\S]*?)<\/section>/g)].filter(([,card])=>/<div class="ea-bk">\s*Bet\s*365\s*<\/div>/i.test(card));
  if(cards.length!==1)return null;
  const card=cards[0][1],markets=[];
  const result=card.match(/<div class="ea-eu">([\s\S]*?)<\/div>/)?.[1]||'';
  const winPrices=[...result.matchAll(/<span>([^<]+)<\/span>/g)].map(m=>m[1].trim());
  if(winPrices.length===3&&winPrices.every(validOdds))markets.push({name:'1X2',prices:winPrices.map(v=>hongKongOdds(Number(v)))});
  const headers=card.match(/<div class="ea-row ea-row-head">([\s\S]*?)<\/div>/)?.[1]||'';
  const columns=[...headers.matchAll(/<span class="ea-group">([^<]+)<\/span>/g)].map(m=>m[1].trim());
  if(['Theoretical|Actual','理論指數|實際指數'].includes(columns.join('|'))){
    for(const [,row] of card.matchAll(/<div class="ea-row">([\s\S]*?)<\/div>/g)){
      const label=row.match(/<span class="ea-rowlabel">(AH|O\/U|讓球|進球)<\/span>/)?.[1];
      const cell=row.split('<span class="ea-cell">');
      if(!label||cell.length!==3)continue;
      const m=cell[2].match(/^\s*<b>([^<]+)<\/b>\s*<i>([-+]?\d+(?:\.\d+)?)<\/i>\s*<b>([^<]+)<\/b>\s*<\/span>/);
      if(!m||!validOdds(m[1])||!validOdds(m[3]))continue;
      const line=Number(m[2]);
      const spread=label==='AH'||label==='讓球';
      if(!Number.isInteger(line*4)||(!spread&&line<0))continue;
      markets.push({name:spread?'Spread':'Totals',lines:[{line,first:hongKongOdds(Number(m[1])),second:hongKongOdds(Number(m[3]))}]});
    }
  }
  return {status:markets.length?'priced':'noQuote',scope:'public',checkedAt,sourceUrl,markets};
}
export async function publicHtml(url){
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),5500);
  try{
    const options={redirect:'manual',headers:{accept:'text/html','accept-language':'en'},signal:abort.signal};
    let response=await fetch(url,options);
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');
      const source=new URL(url),next=location&&new URL(location,source);
      if(!next||source.origin!==origin||next.origin!==origin||next.username||next.password||next.pathname!=='/zh-tw'+source.pathname||next.search!==source.search)throw new Error('http_'+response.status);
      response=await fetch(next.href,options);
    }
    if(!response.ok)throw new Error('http_'+response.status);
    const body=await response.text();
    if(body.length>3_000_000)throw new Error('size_limit');
    return body;
  }catch(error){
    if(/^http_[0-9]{3}$|^size_limit$/.test(error.message))throw error;
    throw new Error(abort.signal.aborted?'timeout':'connection_error');
  }finally{clearTimeout(timer);}
}
