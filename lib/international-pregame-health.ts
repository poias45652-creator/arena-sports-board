import type {RunAnalysis} from './baseball-run-analysis';

/** Judge the merged data, not whether every optional provider responded. */
export function internationalPregameHealth(feed:{stale?:boolean;status?:string},reports:Pick<RunAnalysis,'status'|'mode'>[]){
 if(feed.stale||feed.status==='unavailable')return 'stale';
 if(feed.status==='partial'||reports.some(report=>report.status==='waiting_data'||report.status==='ready'&&report.mode==='simulation'))return 'partial';
 // Started fixtures have correctly stopped pregame estimation; this is not
 // missing source data. Provider errors remain in the response diagnostics.
 return 'ready';
}
