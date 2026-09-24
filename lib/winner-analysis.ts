import {baseProbability, fresh, isPregame, type Match} from './baseball';
import {multifactorWin} from './multifactor-win';
import type {AnalysisReport} from './pregame-analysis';

export const WINNER_DISPLAY_VERSION = 'moneyline-stages-v2-preliminary';
export type WinnerAnalysis = ReturnType<typeof multifactorWin> & {
  status: 'blocked' | 'preliminary' | 'ready';
  canEstimate: boolean;
  canRecommend: boolean;
  favoredSide: 'home' | 'away' | null;
  missing: string[];
};
const measured = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Allow usable preliminary estimates in recommendations without treating them as full data.
 * The underlying model, 60% starter budget and 80% full-data gate are unchanged.
 * Never promote partial inputs, expired reports or mismatched starters to ready. */
export function winnerAnalysis(
  game: Match, report: AnalysisReport | undefined, now: number, scheduleOK: boolean,
): WinnerAnalysis {
  const model = multifactorWin(game, report, now);
  const missing = model.factors.filter(factor => factor.score === null).map(factor => factor.name);
  let blocked = '';
  if (!scheduleOK) blocked = '賽程資料尚未取得或已過期';
  else if (!isPregame(game, now)) blocked = game.state === 'Final' ? '已完賽，不提供回填預測' : '已開賽或賽事狀態不符，賽前分析已關閉';
  else if (baseProbability(game) === null) blocked = '戰績不足 20 場或資料缺漏';
  else {
    const coreMissing: string[] = [];
    for (const side of ['away', 'home'] as const) {
      const team = game[side], label = side === 'away' ? '客隊' : '主隊';
      if (!Number.isInteger(team.pitcherId) || (team.pitcherId ?? 0) <= 0) coreMissing.push(`${label}先發投手尚未公布`);
      else {
        if (!measured(team.pitcherEra)) coreMissing.push(`${label}先發本季 ERA 缺漏`);
        if (!measured(team.pitcherWhip)) coreMissing.push(`${label}先發本季 WHIP 缺漏`);
      }
    }
    blocked = coreMissing.join('；');
  }
  if (!blocked && report) {
    const sameFixture = report.game.id === game.id && report.game.date === game.date && report.game.season === game.season &&
      (['away', 'home'] as const).every(side => report.game[side].id === game[side].id && report.game[side].pitcherId === game[side].pitcherId);
    if (!sameFixture) blocked = '先發／賽程已變更，等待重新整合本場分析';
    else if (!fresh(report.capturedAt, now, 300000)) blocked = '分項分析已過期，等待重新取得';
    else if (report.issues.some(issue => issue.includes('衝突') || issue.includes('先發投手來源不一致'))) blocked = '先發／球員資料衝突，暫停分析推薦';
  }
  if (blocked || model.homeWin === null || !Number.isFinite(model.homeWin)) {
    return {...model, homeWin: null, ready: false, status: 'blocked', canEstimate: false, canRecommend: false,
      favoredSide: null, missing, reason: blocked || '分析所需資料未齊'};
  }
  const favoredSide = Math.abs(model.homeWin - .5) <= .000001 ? null : model.homeWin > .5 ? 'home' : 'away';
  return {...model, status: model.ready ? 'ready' : 'preliminary', canEstimate: true,
    canRecommend: favoredSide !== null, favoredSide, missing,
    reason: model.ready ? (favoredSide ? '' : '雙方試算相同，沒有明確傾向') :
      !report ? '分項分析取得中，先依本季戰績與先發 ERA／WHIP 試算' : model.reason.replace('暫停自動推薦','僅供初步試算')};
}
