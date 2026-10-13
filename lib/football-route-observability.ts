import type {FootballAnalysis,FootballLeague} from './football';

type Stage='next'|'schedule'|'analysis'|'load_forecast'|'save_forecast'|'save_daily_forecast'|'save_results'|'save_daily_results'|'response';
type Context={league:FootballLeague;date:string;kind:string;game:string|null};
const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=1000000?value:null;

function errorCategory(error:unknown){
  if(!(error instanceof Error))return 'unknown';
  if(error.name==='TimeoutError')return 'timeout';
  if(error.name==='AbortError')return 'aborted';
  if(error.name==='SyntaxError')return 'invalid_json';
  const code=(error as Error&{code?:unknown;cause?:{code?:unknown}}).code;
  const cause=(error as Error&{cause?:{code?:unknown}}).cause?.code;
  if([code,cause].some(c=>c==='ETIMEDOUT'||c==='UND_ERR_CONNECT_TIMEOUT'))return 'timeout';
  if([code,cause].some(c=>c==='ECONNRESET'||c==='ECONNREFUSED'||c==='ENOTFOUND')||error.message==='fetch failed')return 'network';
  // Match only our fixed messages; never copy an exception message or body.
  switch(error.message){
    case '足球資料來源暫時無法連線':return 'source_http';
    case '足球來源資料過大':return 'source_too_large';
    case '足球來源格式改變':return 'source_format';
    case '球隊歷史來源身分不符':return 'history_identity';
    case '國家隊歷史來源超出分頁上限':return 'history_limit';
    case '無效進球參數':return 'model_input';
    default:return 'unknown';
  }
}

function reasonCategory(analysis:FootballAnalysis|null|undefined){
  if(analysis===null)return 'fixture_missing';
  if(!analysis)return 'analysis_missing';
  if(analysis.status==='ready')return 'none';
  if(analysis.status==='closed')return 'fixture_closed';
  switch(analysis.reason){
    case '開賽時間尚未確認。':return 'kickoff_unconfirmed';
    case '近期賽果超過120天，等待較新的比賽資料。':return 'history_stale';
    case '本季賽果來源未完整更新，暫停分析以免遺漏最新比賽。':return 'current_history_incomplete';
    case '本年國家隊賽果來源尚未完整更新，等待最新資料。':return 'national_history_incomplete';
    case '國家隊對手強度資料尚未更新。':
    case '國家隊對手強度資料尚未完整更新。':return 'national_strength_unavailable';
    case '跨聯賽對手強度尚未校正，暫不提供模型勝率與比分。':return 'cup_strength_unavailable';
    default:return typeof analysis.reason==='string'&&/^歷史不足：主隊\d+場、客隊\d+場；各需至少5場。$/.test(analysis.reason)?'history_insufficient':'other';
  }
}

/** Called after route validation. Select fields explicitly: no request, headers,
 * account identity, raw reason, exception message, stack or source payload. */
export function createFootballRouteTrace(context:Context){
  const started=performance.now();
  const fields={league:context.league,date:context.date,kind:context.kind,game:context.game};
  let stage:Stage='response';
  function emit(event:string,details:()=>Record<string,unknown>){
    try{
      const elapsed=performance.now()-started;
      console.warn(event,JSON.stringify({...fields,elapsedMs:Number.isFinite(elapsed)?Math.max(0,Math.round(elapsed)):null,...details()}));
    }catch{/* Diagnostics must not change the API response or persistence path. */}
  }
  return {
    stage(value:Stage){stage=value;},
    failure(error:unknown){emit('football-route-failure',()=>({stage,errorCategory:errorCategory(error)}));},
    analysis(analysis:FootballAnalysis|null|undefined){
      stage='response';
      emit('football-analysis-result',()=>({
        stage:'response',status:analysis===null?'not_found':(analysis&&['ready','waiting','closed'].includes(analysis.status)?analysis.status:'unknown'),
        reasonCategory:reasonCategory(analysis),
        historyCounts:{home:count(analysis?.homeForm?.games),away:count(analysis?.awayForm?.games),homeSupplement:count(analysis?.homeForm?.supplementGames),awaySupplement:count(analysis?.awayForm?.supplementGames),conflicts:count(analysis?.quality?.historyConflicts),archiveSupplement:count(analysis?.quality?.archiveSupplementGames)},
      }));
    },
  };
}
