import type {Match} from './baseball';
import type {OddsGame,Quote} from './pinnacle';

function hasQuote(quote:Quote|null|undefined){
  return !!quote&&Number.isFinite(quote.line)&&Number.isFinite(quote.first)&&quote.first>0
    &&Number.isFinite(quote.second)&&quote.second>0&&typeof quote.signature==='string'&&quote.signature.length>0;
}

// Display order follows open source markets, independently of model readiness.
export function orderMatchCards(games:readonly Match[],marketFor:(game:Match)=>OddsGame|null,sourceOK:boolean):Match[]{
  const open:Match[]=[],waiting:Match[]=[];
  for(const game of games){
    const market=sourceOK?marketFor(game):null;
    (market&&(hasQuote(market.spread)||hasQuote(market.total)||Object.values(market.additional??{}).some(hasQuote))?open:waiting).push(game);
  }
  // Keep all whole cards, object identities, and the existing order within each group.
  return [...open,...waiting];
}
