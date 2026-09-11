export class SourceError extends Error{
 constructor(public code:string,message:string){super(message);}
}
export function sourceFailure(error:unknown){
 if(error instanceof SourceError)return {code:error.code,error:error.message};
 if(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name))return {code:'source_timeout',error:'Super007 回應逾時，稍後自動重試。'};
 return {code:'source_unavailable',error:'Super007 連線失敗，稍後自動重試。'};
}
