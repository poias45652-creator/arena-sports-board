'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Table,TableHeader,TableRow,TableHead,TableBody,TableCell} from '@/components/ui/table';
import {isPregame,type Schedule,type Snapshot} from '@/lib/baseball';
import {useSource} from '../use-source';
import TeamName from '../team-name';

const stamp=(value:string)=>new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const percent=(value:number|null|undefined)=>value==null?'缺資料':`${value.toFixed(1)}%`;

export default function MatchComparison(){
  const schedule=useSource<Schedule>('schedule',30000);
  const batting=useSource<Snapshot>('batter-team',20*60000);
  const pitching=useSource<Snapshot>('pitcher-team',20*60000);
  const pitchers=useSource<Snapshot>('pitcher',20*60000);
  const sources=[schedule,batting,pitching,pitchers];
  const [selected,setSelected]=useState('');
  const games=[...(schedule.data?.games||[])].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  const game=games.find(g=>String(g.id)===selected)||games.find(g=>isPregame(g,Date.now()))||games[0];
  const teamStat=(source:Snapshot|null,id:number)=>source?.year===game?.season?source.rows.find(r=>r.teamId===id):undefined;
  const pitcherStat=(id:number|null)=>pitchers.data?.year===game?.season?pitchers.data.rows.find(r=>r.id===String(id)):undefined;
  const stats=game?{ab:teamStat(batting.data,game.away.id),hb:teamStat(batting.data,game.home.id),ap:teamStat(pitching.data,game.away.id),hp:teamStat(pitching.data,game.home.id),as:pitcherStat(game.away.pitcherId),hs:pitcherStat(game.home.pitcherId)}:null;
  const rows: [string,number|null|undefined,number|null|undefined][] = stats?[
    ['團隊強勁擊球率',stats.ab?.hardHit,stats.hb?.hardHit],
    ['團隊優質擊球／打席',stats.ab?.barrelPa,stats.hb?.barrelPa],
    ['團隊被優質擊球／打席',stats.ap?.barrelPa,stats.hp?.barrelPa],
    ['先發被強勁擊球率',stats.as?.hardHit,stats.hs?.hardHit],
    ['先發被優質擊球／打席',stats.as?.barrelPa,stats.hs?.barrelPa],
  ]:[];
  return <section className="panel space-y-4 p-5" aria-label="投打對照與估算依據">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">投打對照與估算依據</h2><Button variant="outline" disabled={sources.some(s=>s.loading)} onClick={()=>sources.forEach(s=>void s.refresh())}>更新資料</Button></div>
    {!!games.length&&<Select value={String(game.id)} onValueChange={setSelected}><SelectTrigger className="h-auto min-h-10 w-full whitespace-normal text-left" aria-label="選擇要檢查的比賽"><SelectValue/></SelectTrigger><SelectContent>{games.map(g=><SelectItem key={g.id} value={String(g.id)}><span className="flex flex-wrap items-center gap-2"><span>{stamp(g.date)}</span><TeamName team={g.away} size={20}/><span>vs</span><TeamName team={g.home} size={20}/></span></SelectItem>)}</SelectContent></Select>}
    {sources.some(s=>s.error)&&<p role="status" className="text-sm text-amber-200">部分來源更新失敗，目前顯示最近取得的資料；缺值不當作零。</p>}
    {!game?<p role="status" className="text-sm text-slate-400">{schedule.loading?'正在取得賽程…':'目前沒有可查看的賽事。'}</p>:<>
      <p className="text-sm text-slate-400">{game.season} 球季累計資料，非今日打線；投球被擊球率通常越低越佳。比較不等於勝率加權。</p>
      <Table><TableHeader><TableRow><TableHead>指標</TableHead><TableHead><TeamName team={game.away}/>（客）</TableHead><TableHead><TeamName team={game.home}/>（主）</TableHead></TableRow></TableHeader><TableBody>{rows.map(([title,away,home])=><TableRow key={title}><TableCell>{title}</TableCell><TableCell>{percent(away)}</TableCell><TableCell>{percent(home)}</TableCell></TableRow>)}</TableBody></Table>
      <p className="text-sm text-slate-400">勝率只使用雙方戰績；戰績接近時估算也接近五成。先發與投打指標用於檢查對戰差異。開賽後不使用賽後資料回填勝率。</p>
    </>}
  </section>;
}
