import {plain,tableData,numberOrNull} from './baseball-live-providers.mjs';

// Only the dated, exact game page can supply its starting lineup. Bench players
// and current batters in sidebar cards are never treated as probable starters.
export function addNpbContext(game,page){
 const canonical=page.text.match(/property="og:url"\s+content="([^"]+)"/)?.[1];
 if(canonical!==`https://baseball.yahoo.co.jp/npb/game/${game.id}/top`)throw Error('NPB context game identity conflict');
 const title=plain(page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 const date=title.match(/^(\d{4})年(\d+)月(\d+)日/);
 if(!date||`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`!==game.date)throw Error('NPB context date conflict');
 const source={provider:'sportsnavi',url:page.url,fetchedAt:page.fetchedAt};
 for(const t of tableData(page.text)){
  const id=t.attrs.match(/--npbTeam(\d+)/)?.[1],side=id===game.home.id?'home':id===game.away.id?'away':null;
  if(!side)continue;const [h,...rows]=t.rows,nameIndex=h.indexOf('選手名');if(nameIndex<0)continue;
  if(h[0]==='投手'&&h.includes('防御率')){
   const row=rows.find(r=>r[0]==='先発');if(row?.[nameIndex])game.starters[side]={id:null,name:row[nameIndex],confirmation:'source_starting',era:numberOrNull(row[h.indexOf('防御率')]),throws:row[h.indexOf('投')]||null,source};
  }
  if(h[0]==='打順'){
   const lineup=rows.filter(r=>/^[1-9]$/.test(r[0])&&r[nameIndex]).map(r=>({id:null,name:r[nameIndex],order:Number(r[0]),position:r[h.indexOf('位置')]||null,confirmation:'source_listed'}));
   if(lineup.length===9&&new Set(lineup.map(x=>x.order)).size===9){game.lineups[side]=lineup;game.lineupConfirmation='source_listed';}
  }
 }
 // Before lineups are announced, use the two explicitly named starter sections.
 const begin=page.text.indexOf('id="async-starter"'),end=page.text.indexOf('id="async-preview"',begin),region=begin>=0&&end>begin?page.text.slice(begin,end):'';
 for(const section of region.matchAll(/<section class="bb-splits__item">([\s\S]*?)<\/section>/g)){
  const id=section[1].match(/--npbTeam(\d+)/)?.[1],side=id===game.home.id?'home':id===game.away.id?'away':null;if(!side)continue;
  const tables=tableData(section[1]),identity=tables.find(t=>t.rows[0]?.includes('選手名'));
  const name=identity?.rows[1]?.[identity.rows[0].indexOf('選手名')];if(!name)continue;
  const season=tables.find(t=>t.rows[0]?.includes('防御率')&&t.rows.some(r=>r.includes('今季'))),row=season?.rows.find(r=>r.includes('今季'));
  const stat=label=>row?numberOrNull(row[season.rows[0].indexOf(label)]):null;
  game.starters[side]={id:null,name,confirmation:'probable',era:stat('防御率'),wins:stat('勝利'),losses:stat('敗戦'),source};
 }
 return game;
}
