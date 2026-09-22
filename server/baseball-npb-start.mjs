import {plain} from './baseball-live-providers.mjs';
/** Read only the selected, dated Sportsnavi game, never sidebar clocks. */
export function npbGameStart(html,id,date,previous=null){
 const title=plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''),day=title.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
 const canonical=html.match(/property="og:url"\s+content="([^"]+)"/)?.[1];
 if(!day||`${day[1]}-${day[2].padStart(2,'0')}-${day[3].padStart(2,'0')}`!==date||canonical!==`https://baseball.yahoo.co.jp/npb/game/${id}/top`)throw Error('日職時間頁場次或日期不符');
 const clocks=[...html.matchAll(/<(?:p|span|div)\b[^>]*class=["'][^"']*\bbb-gameCard__time\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|span|div)>/gi)].map(m=>plain(m[1])).filter(s=>/^\d{1,2}:\d{2}$/.test(s));
 const unique=[...new Set(clocks)];if(unique.length>1)throw Error('日職開賽時間互相衝突');if(!unique.length)return previous;
 const [hour,minute]=unique[0].split(':').map(Number);if(hour>23||minute>59)throw Error('日職開賽時間無效');
 const ms=Date.parse(`${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00+09:00`);
 if(!Number.isFinite(ms)||new Date(ms+9*3600000).toISOString().slice(0,10)!==date)throw Error('日職日期無效');
 if(previous&&Date.parse(previous)!==ms)throw Error('日職開賽時間欄位不一致');return new Date(ms).toISOString();
}
