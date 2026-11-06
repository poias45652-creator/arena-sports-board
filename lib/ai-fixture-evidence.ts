import {aiDay,type AiEvidence,type AiMatch,type AiSnapshot} from './ai-assistant';

type Side = 'home' | 'away';
const sides = ['home','away'] as const;
const rowsOf = (value:unknown):any[] => Array.isArray(value)?value.filter(row=>row&&typeof row==='object'):[];
const score = (value:unknown) => (typeof value==='number'||typeof value==='string') && /^(0|[1-9]\d{0,2})$/.test(String(value)) ? Number(value) : null;
const id = (value:unknown) => typeof value==='string' && /^\d{1,12}$/.test(value);
const statusLabels:Record<string,string> = {
 INJURY_STATUS_OUT:'缺陣', INJURY_STATUS_DAYTODAY:'逐日觀察',
 INJURY_STATUS_DOUBTFUL:'出賽機率偏低', INJURY_STATUS_QUESTIONABLE:'出賽存疑', INJURY_STATUS_PROBABLE:'可能出賽'
};

function recentRecord(rows:any[],teamId:string,gameId:string,cutoff:number,basketball:boolean){
 if(!Array.isArray(rows)||!rows.length||rows.length>5||new Set(rows.map(r=>r?.id)).size!==rows.length)return null;
 let wins=0,draws=0,scored=0,allowed=0;
 for(const r of rows){
  if(!r)return null;
  const at=Date.parse(r.gameDate),home=r.homeTeamId===teamId;
  const own=score(home?r.homeTeamScore:r.awayTeamScore),opp=score(home?r.awayTeamScore:r.homeTeamScore);
  if(!id(r.id)||r.id===gameId||!(at<cutoff)||(!home&&r.awayTeamId!==teamId)||
     !id(r.opponent?.id)||r.opponent.id===teamId||r.opponent.id!==(home?r.awayTeamId:r.homeTeamId)||
     own===null||opp===null||(basketball&&(own===opp||own===0||opp===0))||
     r.gameResult!==(own>opp?'W':own===opp?'D':'L'))return null;
  wins+=Number(own>opp);draws+=Number(own===opp);scored+=own;allowed+=opp;
 }
 return {games:rows.length,wins,draws,losses:rows.length-wins-draws,scored,allowed};
}

// Read only historical results and dated availability. The provider's odds and
// projected winner are deliberately outside this evidence set.
export function fixtureEvidence(match:AiMatch,raw:any,capturedAt:string,now=Date.now(),officialPlayers?:Record<Side,any[]>){
 const facts:AiEvidence[]=[],header=raw?.header,comp=header?.competitions?.[0];
 const cutoff=Date.parse(capturedAt),kickoff=Date.parse(match.start);
 const teamIds={home:match.homeId,away:match.awayId};
 const basketball=match.league==='NBA'||match.league==='WNBA';
 if(!(cutoff<=now&&now-cutoff<=120000&&now<kickoff)||header?.league?.slug!==match.league.toLowerCase()||
    header.id!==match.id||comp?.id!==match.id||Date.parse(comp.date)!==kickoff||
    comp.status?.type?.name!=='STATUS_SCHEDULED'||rowsOf(comp.competitors).length!==2||
    !id(teamIds.home)||!id(teamIds.away)||match.homeId===match.awayId||
    !sides.every(side=>rowsOf(comp.competitors).some((r:any)=>r.homeAway===side&&r.team?.id===teamIds[side])))return facts;
 const records:Partial<Record<Side,NonNullable<ReturnType<typeof recentRecord>>>>={};
 for(const side of sides){
  const team=teamIds[side],groups=rowsOf(raw.lastFiveGames).filter((r:any)=>r.team?.id===team);
  const record=groups.length===1?recentRecord(groups[0].events,team!,match.id,cutoff,basketball):null;
  if(!record)continue;
  records[side]=record;
  const {games,wins,draws,losses,scored,allowed}=record;
  facts.push({id:'recent-'+side,topic:'data',side,text:`ESPN 列出的${match[side]}近 ${games} 場：${wins} 勝${basketball?'':`、${draws} 和`}、${losses} 敗，合計${basketball?'得':'進'} ${scored}${basketball?' 分':' 球'}、失 ${allowed}${basketball?' 分':' 球'}。`});
 }
 if(records.home?.games===5&&records.away?.games===5){
  const home=records.home.scored-records.home.allowed,away=records.away.scored-records.away.allowed;
  if(home!==away){
   const side=home<away?'home':'away',other=side==='home'?'away':'home',label=basketball?'淨得分':'淨勝球';
   facts.push({id:'recent-margin-'+side,topic:'risk',side,riskKind:'adverse',text:`ESPN 近五場的合計${label}，${match[side]}為 ${Math.min(home,away)}，${match[other]}為 ${Math.max(home,away)}。${match[side]}近期的得失差較低。`});
  }
 }

 const series=rowsOf(raw.seasonseries).find((s:any)=>s.type===(basketball?'season':'head-to-head'));
 const played=rowsOf(series?.events).filter((e:any)=>id(e.id)&&e.id!==match.id&&Date.parse(e.date)<cutoff&&
  e.status==='post'&&e.statusType?.completed===true&&rowsOf(e.competitors).length===2&&
  sides.every(side=>rowsOf(e.competitors).some((t:any)=>t.team?.id===teamIds[side]&&score(t.score)!==null)));
 if(played.length&&new Set(played.map((e:any)=>e.id)).size===played.length){
  const recent=played.sort((a:any,b:any)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,5);
  const games=recent.map((e:any)=>{
   const points=(side:Side)=>score(e.competitors.find((t:any)=>t.team.id===teamIds[side]).score);
   return `${aiDay(e.date)}　${match.home} ${points('home')} 比 ${points('away')} ${match.away}`;
  });
  facts.push({id:'prior-meetings',topic:'data',text:`ESPN ${basketball?'本季':'近期'}交手紀錄（台灣日期，由近到遠）\n${games.join('\n')}`});
 }
 if(!basketball||kickoff-cutoff>72*3600000)return facts;
 for(const side of sides){
  const groups=rowsOf(raw.injuries).filter((r:any)=>r.team?.id===teamIds[side]);
  if(groups.length!==1||!Array.isArray(groups[0].injuries))continue;
  const news=rowsOf(groups[0].injuries);
  for(const r of news.slice(0,30)){
   const player=r.athlete,at=Date.parse(r.date),label=statusLabels[r.type?.name];
   if(!label||!id(player?.id)||typeof player.displayName!=='string'||!player.displayName.trim()||player.displayName.length>100||
      !(at<=cutoff&&cutoff-at<=72*3600000)||news.filter((n:any)=>n.athlete?.id===player.id).length!==1)continue;
   // Verified roster evidence takes precedence over a secondary injury listing.
   if(officialPlayers){const p=officialPlayers[side]?.find(p=>p.name===player.displayName);if(!p||p.status!=='unknown')continue;}
   facts.push({id:`injury-report-${side}-${player.id}`,topic:r.type.name==='INJURY_STATUS_PROBABLE'?'data':'risk',side,...(r.type.name==='INJURY_STATUS_PROBABLE'?{}:{riskKind:'adverse' as const}),text:`ESPN 傷兵名單（${aiDay(r.date)}）：${match[side]}的 ${player.displayName} 列為「${label}」。`});
  }
 }
 return facts;
}

type HistoricalGame={id:string;state:string;start:string;home:{id:string};away:{id:string};homeScore:number|null;awayScore:number|null};
type TeamResults={team:{id:string};results:HistoricalGame[];fetchedAt:string};

// The existing team pages also cover earlier seasons. Use them when the fixture
// summary lists only future meetings, or omits a team's recent results.
export function teamHistoryEvidence(match:AiMatch,side:Side,profile:TeamResults,existing:AiEvidence[],now=Date.now()){
 const facts:AiEvidence[]=[],team=side==='home'?match.homeId:match.awayId;
 const captured=Date.parse(profile.fetchedAt),kickoff=Date.parse(match.start);
 if(!team||profile.team.id!==team||!(captured<=now&&now-captured<=61*60000&&now<kickoff))return facts;
 const games=profile.results.filter(g=>g.state==='final'&&g.id!==match.id&&Date.parse(g.start)<captured&&
  (g.home.id===team||g.away.id===team)&&g.home.id!==g.away.id&&score(g.homeScore)!==null&&score(g.awayScore)!==null)
  .sort((a,b)=>Date.parse(b.start)-Date.parse(a.start));
 if(new Set(games.map(g=>g.id)).size!==games.length)return facts;
 if(!existing.some(f=>f.id==='recent-'+side)&&games.length){
  const latest=games.slice(0,5),basketball=match.league==='NBA'||match.league==='WNBA';
  let wins=0,draws=0,scored=0,allowed=0;
  for(const g of latest){
   const home=g.home.id===team,own=home?g.homeScore!:g.awayScore!,opp=home?g.awayScore!:g.homeScore!;
   wins+=Number(own>opp);draws+=Number(own===opp);scored+=own;allowed+=opp;
  }
  facts.push({id:'recent-'+side,topic:'data',side,text:`ESPN 球隊賽程中的${match[side]}近 ${latest.length} 場：${wins} 勝${basketball?'':`、${draws} 和`}、${latest.length-wins-draws} 敗，合計${basketball?'得':'進'} ${scored}${basketball?' 分':' 球'}、失 ${allowed}${basketball?' 分':' 球'}。`});
 }
 if(!existing.some(f=>f.id==='prior-meetings')){
  const meetings=games.filter(g=>g.home.id===match.homeId&&g.away.id===match.awayId||g.home.id===match.awayId&&g.away.id===match.homeId).slice(0,5);
  if(meetings.length)facts.push({id:'prior-meetings',topic:'data',text:'ESPN 球隊賽程中的交手紀錄（台灣日期，由近到遠）\n'+meetings.map(g=>
   `${aiDay(g.start)}　${match.home} ${g.home.id===match.homeId?g.homeScore:g.awayScore} 比 ${g.home.id===match.homeId?g.awayScore:g.homeScore} ${match.away}`).join('\n')});
 }
 return facts;
}

export function withFixtureEvidence(match:AiMatch,model:AiSnapshot|null,facts:AiEvidence[],capturedAt:string):AiSnapshot|null{
 if(!facts.length)return model;
 const adverseSides=new Set(facts.filter(f=>f.riskKind==='adverse').map(f=>f.side));
 const evidence=model?.evidence.filter(f=>f.riskKind!=='reviewed'||!adverseSides.has(f.side))||[];
 if(!model){
  const results=facts.filter(f=>f.topic==='data');
  if(results.length)evidence.push({id:'pregame-records',topic:'analysis',text:'本場尚無可用的模型預測。以下是可核對的賽前紀錄。\n'+results.map(f=>f.text).join('\n')});
 }
 return {...(model||{match,model:'賽前資料',capturedAt,suggestion:null}),evidence:[...evidence,...facts]};
}
