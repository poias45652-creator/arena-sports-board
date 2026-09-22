/** Bare fixture times are Taipei local time; explicit offsets are respected. */
export function internationalFixtureTime(start:string):number{
 const m=String(start??'').trim().replaceAll('/','-').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/);
 if(!m||Number(m[2])>23||Number(m[3])>59||Number(m[4]||0)>59)return NaN;
 const date=Date.parse(m[1]+'T00:00:00Z');if(!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==m[1])return NaN;
 return Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]||'00'}${m[5]?'.'+m[5]:''}${m[6]||'+08:00'}`);
}
export function canonicalFixtureStart(start:string):string{
 const ms=internationalFixtureTime(start);return Number.isFinite(ms)?new Date(ms+8*3600000).toISOString().slice(0,19).replace('T',' '):start;
}
