import type {FootballGame} from '@/lib/football';
import {footballFixtureKey,type FootballReport} from '@/lib/football-recommendations';
import type {FootballAnalysisActivity} from './football-report-refresh';

// One queue spans all schedule polls, keeping retries within the same two workers.
export function createFootballReportQueue({signal,request,current,onReport,onError,onActivity,onSettled}:{
  signal:AbortSignal;
  request:(game:FootballGame,signal:AbortSignal)=>Promise<FootballReport>;
  current:(game:FootballGame)=>boolean;
  onReport:(game:FootballGame,report:FootballReport)=>void;
  onError:(game:FootballGame,error:unknown)=>void;
  onActivity:(activity:Record<string,FootballAnalysisActivity>)=>void;
  onSettled:(game:FootballGame)=>void;
}){
  const todo:FootballGame[]=[],activity:Record<string,FootballAnalysisActivity>={};
  let active=0;
  const publish=()=>{if(!signal.aborted)onActivity({...activity});};
  async function run(game:FootballGame){
    const key=footballFixtureKey(game)!;
    try{
      const report=await request(game,signal);
      if(!signal.aborted&&current(game))onReport(game,report);
    }catch(error){if(!signal.aborted&&current(game))onError(game,error);}
    finally{
      active--;delete activity[key];
      if(!signal.aborted){onSettled(game);drain();publish();}
    }
  }
  function drain(){
    while(active<2&&todo.length&&!signal.aborted){
      const game=todo.shift()!,key=footballFixtureKey(game)!;
      if(!current(game)){delete activity[key];continue;}
      activity[key]='loading';active++;void run(game);
    }
  }
  return {
    has:(game:FootballGame)=>!!activity[footballFixtureKey(game)!],
    enqueue(games:FootballGame[]){
      if(signal.aborted)return;
      for(const game of games){const key=footballFixtureKey(game)!;if(activity[key])continue;activity[key]='queued';todo.push(game);}
      drain();publish();
    },
  };
}
