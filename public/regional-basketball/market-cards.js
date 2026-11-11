import {basketballMarketGrid, settleSportGrid} from './market-math.mjs';
import {e, logo, name, stamp, teamFor, timeTW} from './shared.js';

const labels = {spread: '全場讓分', total: '全場大小分', moneyline: '全場獨贏'};
const percent = value => (value * 100).toFixed(1) + '%';
const outcomes = [['全贏', 'win', 'win'], ['中洞贏', 'partialWin', 'win'], ['中洞輸', 'partialLoss', 'loss'], ['全輸', 'loss', 'loss']];
function outcomeHtml(result) {
  if (!result) return '<p class="sport-market-pending">因分析資料不足無法分析</p>';
  const cells = outcomes.map(([label, field, tone]) =>
    '<div data-tone="' + tone + '"><dt>' + label + '</dt><dd>' + percent(result[field]) + '</dd></div>');
  const push = result.push > 1e-7 ? '<div class="sport-market-push"><span>退回</span><b>' + percent(result.push) + '</b></div>' : '';
  return '<dl class="sport-market-outcomes">' + cells.join('') + '</dl>' + push;
}

export function marketCards(s, g, model, market, quotes) {
  if (!quotes.length) {
    const reason = s.tzMessage || (stamp(g) <= Date.now() ? '此場沒有已核實的賽前盤口存檔。' : '此場暫無可配對的全場盤口。');
    return '<p class="sport-markets sport-market-pending">' + e(reason) + '</p>';
  }
  const grid = model.ready ? {
    spread: basketballMarketGrid(model.margin, model.spreadSigma, 'margin', model.homeProb),
    total: basketballMarketGrid(model.total, model.totalSigma, 'total'),
  } : {spread: [], total: []};
  const blocks = quotes.map(quote => {
    const sides = quote.kind === 'total' ? ['over', 'under'] : ['home', 'away'];
    const cards = sides.map((side, i) => {
      const team = g[side];
      const title = quote.kind === 'total' ? (side === 'over' ? '大' : '小') :
        logo(teamFor(s, team), 'sport-market-logo') + '<span>' + e(name(s, team)) + '</span>';
      const odds = (i === 0 ? quote.home : quote.away).toFixed(3);
      let result;
      if (quote.kind === 'moneyline') {
        const prob = side === 'home' ? model.homeProb : model.awayProb;
        result = model.ready && Number.isFinite(prob) ? '<div class="sport-market-win-rate"><span>勝率</span><b>' + percent(prob) + '</b></div>' : outcomeHtml(null);
      } else {
        result = outcomeHtml(settleSportGrid(grid[quote.kind], quote, side));
      }
      return '<div class="sport-market-option" data-side="' + side + '"><div class="sport-market-option-heading"><strong class="sport-market-team">' +
        title + '</strong><strong class="sport-market-quote">' + (quote.labels[i] ? e(quote.labels[i]) + ' ' : '') + '@' + odds + '</strong></div>' + result + '</div>';
    });
    return '<div class="sport-market-block" data-market="' + quote.kind + '"><div class="sport-market-heading"><strong>' + labels[quote.kind] +
      '</strong></div><div class="sport-market-options' + (quote.kind === 'moneyline' ? ' sport-market-moneyline' : '') + '">' + cards.join('') + '</div></div>';
  });
  const basis = model.replay && model.ready ? '<p class="sport-market-pending">歷史回算・採聯盟預設權重與比賽日前的技術統計，未計入賽前預測命中紀錄。</p>' : '';
  const timing = stamp(g) <= Date.now() ? '存檔盤口' : '賽前盤口';
  return '<section class="sport-markets" aria-label="全場過盤率"><div class="sport-market-heading"><span>全場・含延長賽</span><small>賠率不含本金</small></div>' +
    basis + blocks.join('') + (s.admin ? '<p>' + e(timing) + '・查核 ' + e(timeTW(market.checkedAt)) + '</p>' : '') + '</section>';
}
