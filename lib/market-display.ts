import type {MarketPick} from './markets';

type LineQuote=Pick<MarketPick,'line'|'boundary'|'parts'|'display'>;

// Source quotes remain in the home team's coordinates. Only the label changes sides.
export function formatSpreadLine(quote:LineQuote,side:'home'|'away'):string{
  if(!Number.isFinite(quote.line))return '—';
  const team=side==='home'?'主':'客',direction=side==='home'?1:-1;
  const line=quote.line*direction,boundary=(quote.boundary??0)*direction;
  const source=quote.display?.trim().match(/^([主客])讓\s*[-+]?(.+)$/);
  const raw=source?.[2].trim()??'';
  const percentage=raw.match(/^(\d+)([+-])(\d{1,3})$/);
  if(line===0&&boundary===0&&!percentage)return team+'平手 PK';
  const giving=line<0||(line===0&&(source?source[1]===team:boundary<0));
  const sign=giving?'-':'+';
  const amount=raw.includes('/')&&quote.parts?.length
    ?quote.parts.map(part=>sign+Math.abs(part)).join('/')
    :sign+Math.abs(line);
  const percentSign=boundary<0?'-':boundary>0?'+':percentage
    ?giving?percentage[2]:percentage[2]==='+'?'-':'+'
    :'+';
  const fraction=percentage?percentSign+percentage[3]
    :boundary!==0?percentSign+Number((Math.abs(boundary)*100).toFixed(6)):'';
  return team+(giving?'讓 ':'受讓 ')+amount+fraction;
}

// Total thresholds stay positive; only the under side's percentage sign reverses.
export function formatTotalLine(quote:LineQuote,side:'over'|'under'):string{
  if(!Number.isFinite(quote.line))return '—';
  const raw=quote.display?.trim()||String(quote.line);
  const percentage=raw.match(/^(\d+)([+-])(\d{1,3})$/);
  if(percentage){
    const sign=side==='over'?percentage[2]:percentage[2]==='+'?'-':'+';
    return percentage[1]+sign+percentage[3];
  }
  const boundary=(quote.boundary??0)*(side==='over'?1:-1);
  return boundary===0?raw:raw+(boundary>0?'+':'-')+Number((Math.abs(boundary)*100).toFixed(6));
}

export function formatPickLine(pick:Pick<MarketPick,'market'|'side'|'line'|'boundary'|'parts'|'display'>):string{
  return pick.market==='spread'
    ?formatSpreadLine(pick,pick.side==='away'?'away':'home')
    :formatTotalLine(pick,pick.side==='under'?'under':'over');
}
