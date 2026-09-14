'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {RefreshCw,UserRound} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {PLAYER_COLUMNS,PLAYER_GAME_TYPES,playerHand,playerHeight,playerPosition,type PlayerGroup,type PlayerProfileData,type PlayerStat,type PlayerStatLine} from '@/lib/player-profile';
import TeamName from './team-name';

const value=(stat:PlayerStat|null,key:string)=>stat?.[key]??'—';
const handDate=(date:string|null)=>date?date.replaceAll('-',' / '):'尚未提供';
function StatTable({group,rows,mode}:{group:PlayerGroup;rows:PlayerStatLine[];mode:'history'|'games'}){
  return <Table><caption className="sr-only">{mode==='history'?'歷年':'逐場'}{group==='pitching'?'投球':'打擊'}成績</caption><TableHeader><TableRow><TableHead>{mode==='history'?'球季':'日期'}</TableHead><TableHead>{mode==='history'?'球隊':'對手'}</TableHead>{PLAYER_COLUMNS[group].map(([key,label])=><TableHead key={key} className="text-right">{label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row,index)=><TableRow key={`${row.season}-${row.gameId||row.team?.id||'total'}-${index}`}><TableCell className="font-semibold">{mode==='history'?row.season:row.date||'—'}</TableCell><TableCell>{mode==='history'?(row.team?<TeamName team={row.team} size={20}/>:<span>合計</span>):row.opponent?<span>{row.home===null?'':row.home?'主 · ':'客 · '}<TeamName team={row.opponent} size={20}/></span>:'—'}</TableCell>{PLAYER_COLUMNS[group].map(([key])=><TableCell key={key} className="text-right tabular-nums">{value(row.stat,key)}</TableCell>)}</TableRow>)}</TableBody></Table>;
}

export default function PlayerProfile({id,initialSeason,initialType}:{id:number;initialSeason:number;initialType:string}){
  const [season,setSeason]=useState(String(initialSeason)),[type,setType]=useState(initialType),[view,setView]=useState('overview'),[selectedGroup,setSelectedGroup]=useState<PlayerGroup|null>(null),[photoFailed,setPhotoFailed]=useState(false);
  const [state,setState]=useState<{key:string;data:PlayerProfileData|null;error:string}>({key:'',data:null,error:''}),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
  const query=`id=${id}&season=${season}&type=${type}`;
  useEffect(()=>{
    const controller=new AbortController();let active=true;setLoading(true);
    const timeout=setTimeout(()=>controller.abort(),55000);
    void (async()=>{try{
      const response=await fetch('/api/player?'+query,{signal:controller.signal,cache:'no-store'}),data=await response.json();
      if(!response.ok)throw new Error(data.error||'球員資料暫時無法取得。');
      if(data.player?.id!==id||data.season!==Number(season)||data.gameType!==type)throw new Error('球員資料尚未同步，請重試。');
      if(active)setState({key:query,data,error:''});
    }catch(error){if(active)setState({key:query,data:null,error:controller.signal.aborted?'讀取逾時，請重試。':error instanceof Error?error.message:'球員資料暫時無法取得。'});}
    finally{clearTimeout(timeout);if(active)setLoading(false);}})();
    return()=>{active=false;clearTimeout(timeout);controller.abort();};
  },[query,revision,id,season,type]);
  useEffect(()=>{const timer=setInterval(()=>setRevision(n=>n+1),5*60000);return()=>clearInterval(timer);},[]);
  const data=state.key===query?state.data:null,error=state.key===query?state.error:'',player=data?.player;
  const group=selectedGroup??(player&&['P','TWP'].includes(player.position)?'pitching':'hitting'),stats=data?.groups[group];
  const years=[...new Set([new Date().getUTCFullYear(),Number(season),...(data?Object.values(data.groups).flatMap(g=>g.history.map(r=>r.season)):[])])].filter(y=>y>=1876).sort((a,b)=>b-a);
  const summary=group==='pitching'?[['era','防禦率 ERA'],['whip','WHIP'],['inningsPitched','投球局數'],['strikeOuts','三振'],['wins','勝投'],['saves','救援成功']]:[['avg','打擊率 AVG'],['ops','OPS'],['hits','安打'],['homeRuns','全壘打'],['rbi','打點'],['stolenBases','盜壘']];
  const typeName=PLAYER_GAME_TYPES.find(([key])=>key===type)?.[1]||'例行賽';
  return <main className="arena-shell min-h-screen"><header className="team-page-nav"><Link href="/">← YJ體育分析</Link><Link href="/teams">球隊一覽</Link></header><div className="team-page-container player-page">
    <div className="team-identity player-identity"><div className="player-portrait"><UserRound aria-hidden="true"/>{!photoFailed&&<img src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_240,q_auto:best/v1/people/${id}/headshot/67/current`} width={120} height={150} alt={player?`${player.name} 頭像`:''} onError={()=>setPhotoFailed(true)}/>}</div><div><p className="league-eyebrow">MLB / 球員數據</p><h1>{player?.name||'球員數據'}</h1>{player&&<><p className="player-subtitle">#{player.number||'—'} · {playerPosition(player.position)}</p>{player.team&&<Link href={`/teams/${player.team.id}`} className="player-team-link"><TeamName team={player.team} size={26}/></Link>}</>}</div><Button variant="outline" onClick={()=>setRevision(n=>n+1)} disabled={loading}><RefreshCw className={loading?'animate-spin':''}/>更新</Button></div>
    <div className="team-filters panel"><label className="team-filter"><span>年度</span><Select value={season} onValueChange={setSeason}><SelectTrigger aria-label="球員成績年度"><SelectValue/></SelectTrigger><SelectContent>{years.map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></label><label className="team-filter"><span>賽事類型</span><Select value={type} onValueChange={setType}><SelectTrigger aria-label="球員成績賽事類型"><SelectValue/></SelectTrigger><SelectContent>{PLAYER_GAME_TYPES.map(([key,label])=><SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></label><label className="team-filter"><span>數據類別</span><Select value={group} onValueChange={v=>setSelectedGroup(v as PlayerGroup)}><SelectTrigger aria-label="選擇投球或打擊數據"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="pitching">投球</SelectItem><SelectItem value="hitting">打擊</SelectItem></SelectContent></Select></label></div>
    {error?<div className="panel p-5" role="alert">{error}<Button variant="ghost" onClick={()=>setRevision(n=>n+1)}>重試</Button></div>:!data?<div className="panel p-6" role="status">正在取得球員資料與成績…</div>:<>
      {data.warnings.length>0&&<p role="status" className="mb-4 text-sm text-amber-200">{data.warnings.join(' ')}</p>}
      <Tabs value={view} onValueChange={setView}><TabsList className="league-tabs" aria-label="球員數據分類"><TabsTrigger value="overview">概覽</TabsTrigger><TabsTrigger value="history">歷年成績</TabsTrigger><TabsTrigger value="games">逐場紀錄</TabsTrigger></TabsList><TabsContent value={view}>
        {view==='overview'&&<><div className="team-metrics">{summary.map(([key,label])=><div key={key}><span>{label}</span><strong>{value(stats?.season||null,key)}</strong><small>{season} · {typeName}</small></div>)}</div>{!stats?.season&&<p className="team-footnote">此球季與賽事類型尚無可用的{group==='pitching'?'投球':'打擊'}成績。</p>}
          <div className="team-detail-grid"><section className="panel p-5"><h2 className="team-section-title">個人資料</h2><dl className="player-bio">{[['出生日期',handDate(player!.birthDate)],['年齡',player!.age===null?'尚未提供':`${player!.age} 歲`],['出生地',player!.birthPlace||'尚未提供'],['身高',playerHeight(player!.height)],['體重',player!.weight===null?'尚未提供':`${player!.weight} 磅`],['投打習慣',`${playerHand(player!.pitchHand)}投／${playerHand(player!.batSide)}打`],['MLB 初登場',handDate(player!.debut)]].map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl></section><section className="panel p-5"><h2 className="team-section-title">生涯{group==='pitching'?'投球':'打擊'}成績 <small>· {typeName}</small></h2>{stats?.career?<dl className="player-career">{PLAYER_COLUMNS[group].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{value(stats.career,key)}</dd></div>)}</dl>:<p className="team-footnote">尚無可用的 MLB 生涯{group==='pitching'?'投球':'打擊'}紀錄。</p>}</section></div>
          <section className="panel p-5 mt-5"><h2 className="team-section-title">近期出賽 <small>· {season} · {typeName}</small></h2>{stats?.games.length?<StatTable rows={stats.games.slice(0,10)} group={group} mode="games"/>:<p className="team-footnote">此範圍尚無逐場紀錄。</p>}</section>
        </>}
        {view==='history'&&<section className="panel p-5"><h2 className="team-section-title">歷年{group==='pitching'?'投球':'打擊'}成績 <small>· {typeName}</small></h2>{stats?.history.length?<StatTable rows={stats.history} group={group} mode="history"/>:<p className="team-footnote">尚無可用的歷年成績。</p>}</section>}
        {view==='games'&&<section className="panel p-5"><h2 className="team-section-title">逐場{group==='pitching'?'投球':'打擊'}紀錄 <small>· {season} · {typeName}</small></h2>{stats?.games.length?<StatTable rows={stats.games} group={group} mode="games"/>:<p className="team-footnote">此範圍尚無逐場紀錄。</p>}</section>}
      </TabsContent></Tabs>
      <p className="team-footnote">資料來源：<a href={`https://www.mlb.com/player/${id}`} target="_blank" rel="noreferrer">MLB 官方</a> · 更新 {new Date(data.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}（台灣）</p>
    </>}
  </div></main>;
}
