"""Offline regressions for refreshing NBA statistics with verified identity pairs."""
import copy
import importlib.util
import unittest
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('nba_refresh', ROOT / 'scripts/nba-player-strength.py')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
NOW = core.timestamp('2026-10-05T12:00:00+00:00')
VERIFIED = '2026-10-03T08:40:23+00:00'


def previous():
    return {'schema': 1, 'capturedAt': VERIFIED, 'players': {
        '1001': {'sourceId': '201', 'name': 'First Player', 'points': 999},
        '1002': {'sourceId': '202', 'name': 'Second Player', 'points': 999},
    }}


def observed_row():
    return {'at': NOW - 86400, 'm': 30, 'gs': 15, 'pts': 21,
            'reb': 6, 'ast': 4, 'stl': 1, 'blk': 1, 'tov': 2}


class IdentityRefreshTests(unittest.TestCase):
    def test_existing_id_pairs_are_reused_without_old_statistics(self):
        saved = previous()
        original = copy.deepcopy(saved)
        index, date = core.verified_identity_index(saved, {'201': 'First Player', '202': 'Second Player'}, NOW)
        self.assertEqual(date, VERIFIED)
        self.assertEqual([row['PERSON_ID'] for row in index], ['1001', '1002'])
        self.assertTrue(all(set(row) == {'PERSON_ID', 'PLAYER_FIRST_NAME', 'PLAYER_LAST_NAME'} for row in index))
        self.assertEqual(saved, original)

    def test_normalized_names_allow_punctuation_not_new_identity(self):
        saved = previous()
        saved['players']['1001']['name'] = 'First Player Jr.'
        index, _ = core.verified_identity_index(saved, {'201': 'First Player', '999': 'Second Player'}, NOW)
        self.assertEqual([r['PERSON_ID'] for r in index], ['1001'])

    def test_unknown_renamed_and_missing_players_are_not_guessed(self):
        index, _ = core.verified_identity_index(previous(), {'201': 'Different Person', '999': 'Unknown Player'}, NOW)
        self.assertEqual(index, [])

    def test_duplicate_source_ids_fail_closed(self):
        saved = previous()
        saved['players']['1002']['sourceId'] = '201'
        with self.assertRaisesRegex(ValueError, 'Conflicting'):
            core.verified_identity_index(saved, {'201': 'First Player'}, NOW)

    def test_bad_schema_and_identity_fields_fail_closed(self):
        for mutate in [
            lambda s: s.update(schema=2),
            lambda s: s.update(players=[]),
            lambda s: s['players'].update({'bad-id': {'sourceId': '301', 'name': 'Player'}}),
            lambda s: s['players']['1001'].update(sourceId=''),
            lambda s: s['players']['1001'].update(name=''),
            lambda s: s['players'].update({'1003': None}),
        ]:
            with self.subTest(mutate=mutate):
                saved = previous()
                mutate(saved)
                with self.assertRaises(ValueError):
                    core.verified_identity_index(saved, {}, NOW)

    def test_invalid_and_future_identity_timestamps_fail_closed(self):
        for value in [None, 'bad-time', '2026-10-06T00:00:00+00:00']:
            with self.subTest(value=value):
                saved = previous()
                saved['capturedAt'] = value
                with self.assertRaises(ValueError):
                    core.verified_identity_index(saved, {}, NOW)

    def test_original_identity_verification_time_is_not_laundered(self):
        saved = previous()
        saved['capturedAt'] = '2026-10-05T11:00:00+00:00'
        saved['identitySourceCapturedAt'] = VERIFIED
        _, date = core.verified_identity_index(saved, {}, NOW)
        self.assertEqual(date, VERIFIED)

    def test_new_statistics_are_calculated_from_observed_rows(self):
        names = {'201': 'First Player'}
        index, _ = core.verified_identity_index(previous(), names, NOW)
        result = core.snapshot(defaultdict(list), {'201': [observed_row()]}, names, index, NOW)
        self.assertEqual(result['players']['1001']['points'], 21)
        self.assertEqual(result['players']['1001']['sourceId'], '201')
        self.assertEqual(result['players']['1001']['lastPlayed'], NOW - 86400)
        self.assertEqual(core.timestamp(result['capturedAt']), NOW)

    def test_ambiguous_names_in_fresh_archive_are_excluded(self):
        names = {'201': 'First Player', '999': 'First Player'}
        index, _ = core.verified_identity_index(previous(), names, NOW)
        result = core.snapshot(defaultdict(list), {k: [observed_row()] for k in names}, names, index, NOW)
        self.assertEqual(result['players'], {})

    def test_empty_fresh_history_does_not_reuse_saved_player_production(self):
        names = {'201': 'First Player'}
        index, _ = core.verified_identity_index(previous(), names, NOW)
        result = core.snapshot(defaultdict(list), {}, names, index, NOW)
        self.assertEqual(result['players'], {})
        self.assertEqual(result['teams'], {})

    def test_expired_player_history_is_not_reused(self):
        names = {'201': 'First Player'}
        index, _ = core.verified_identity_index(previous(), names, NOW)
        old_row = {**observed_row(), 'at': NOW - 401 * 86400}
        result = core.snapshot(defaultdict(list), {'201': [old_row]}, names, index, NOW)
        self.assertEqual(result['players'], {})

    def test_runtime_snapshot_and_roster_safety_gates_are_unchanged(self):
        runtime = (ROOT / 'lib/basketball-player-strength.ts').read_text()
        self.assertIn('36*3600000', runtime)
        self.assertIn('player_snapshot_missing_or_stale', runtime)
        source = (ROOT / 'lib/nba-player-strength-source.ts').read_text()
        self.assertIn('officialAnalysisTeam', source)
        self.assertIn('rosterSeason', source)
        self.assertIn('recommendationEligible:false', source)


if __name__ == '__main__':
    unittest.main(verbosity=2)
