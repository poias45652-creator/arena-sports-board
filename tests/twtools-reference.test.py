import copy
import importlib.util
import json
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('twtools_import', ROOT / 'scripts/import-twtools-reference.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
data = json.loads((ROOT / 'data/twtools-reference-20260920.json').read_text())


class TwtoolsReferenceTests(unittest.TestCase):
    def test_mlb_headerless_top_row_and_ties_are_retained(self):
        raw = [['1', 'A', 'Team A', '17'], ['1', 'B', 'Team B', '17'], ['3', 'C', 'Team C', '16']]
        parsed = module.table('勝投', raw, False)
        self.assertEqual(parsed['rows'], raw)
        mlb = data['leagues'][0]
        self.assertEqual(mlb['leaderboards'][0]['rows'][0], ['1', 'Kyle Schwarber', '費城費城人', '45'])
        self.assertEqual(mlb['leaderboardRowCount'], 138)

    def test_import_preserves_distinct_dates_and_periods(self):
        self.assertEqual([l['sourceAsOf'] for l in data['leagues']], ['2026-09-20', '2026-09-17', '2026-09-19', '2026-09-15'])
        self.assertIn('下半季', data['leagues'][1]['scope'])
        self.assertIn('未明示', data['leagues'][1]['scope'])
        self.assertFalse(data['automaticRefreshEnabled'])
        self.assertTrue(all(l['eligibleForMemberAnalysis'] is False for l in data['leagues']))
        for l in data['leagues']:
            module.validate_standings(l['standings'], l['teamCount'])

    def test_missing_or_duplicate_teams_are_rejected(self):
        tables = copy.deepcopy(data['leagues'][1]['standings'])
        tables[0]['rows'][-1] = tables[0]['rows'][0][:]
        with self.assertRaises(ValueError):
            module.validate_standings(tables, 6)
        tables[0]['rows'].pop()
        with self.assertRaises(ValueError):
            module.validate_standings(tables, 6)

    def test_wrong_numeric_columns_are_rejected(self):
        tables = copy.deepcopy(data['leagues'][0]['standings'])
        tables[0]['rows'][0][8] = '0'  # Source column shift: RA no longer agrees with differential.
        with self.assertRaises(ValueError):
            module.validate_standings(tables, 30)

    def test_existing_games_are_not_added_and_conflicts_are_held(self):
        history, parts = {}, ['來源 MLB 官方 StatsAPI']
        for league, provider in [('CPBL', 'rebas.tw'), ('NPB', 'npb.jp'), ('KBO', 'sportify.tw')]:
            rows = [g for g in data['gameAudit'] if g['league'] == league]
            history[league] = []
            for g in rows:
                parts.extend([g['firstTeam'] + str(g['firstScore']), g['secondTeam'] + str(g['secondScore'])])
                history[league].append({'date': g['date'], 'id': g['matchedGameId'], 'completed': True,
                    'homeId': module.IDS[league][g['firstTeam']], 'awayId': module.IDS[league][g['secondTeam']],
                    'homeScore': g['firstScore'], 'awayScore': g['secondScore']})
            parts.append(rows[0]['date'] + ' · 來源 ' + provider)
        page = SimpleNamespace(text=' '.join(parts))
        result = module.audit_games(page, history)
        self.assertEqual(len(result), 11)
        self.assertTrue(all(r['status'] == 'already_present' for r in result))
        history['CPBL'][0]['homeScore'] += 1
        history['NPB'][0]['completed'] = False
        history['KBO'].append(history['KBO'][0].copy())  # Ambiguous doubleheader identity must not be merged.
        changed = module.audit_games(page, history)
        self.assertEqual(sum(r['status'] == 'review_required' for r in changed), 3)
        self.assertTrue(all(r['matchedGameId'] is None for r in changed if r['status'] == 'review_required'))


if __name__ == '__main__':
    unittest.main()
