import copy,importlib.util,json,unittest,hashlib,sqlite3,re
from pathlib import Path
import numpy as np
spec=importlib.util.spec_from_file_location('model','scripts/train-international-models.py');model=importlib.util.module_from_spec(spec);spec.loader.exec_module(model)
class ValidationTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.games,cls.sources=model.load_games();cls.report=json.loads(Path('data/international-validation.json').read_text());cls.pred=json.loads(Path('server/research-data/international-backtest-predictions.json').read_text())
 def test_chronological_partitions_are_disjoint_and_original_sources_are_hashed(self):
  for p,sha in self.report['inputHashes'].items():self.assertEqual(hashlib.sha256(Path(p).read_bytes()).hexdigest(),sha)
  for l,games in self.games.items():
   rows,_=model.reconstruct(games)
   self.assertTrue(all(r['inputThroughDate']<r['date'] and min(r['priorGames'].values())>=20 for r in rows))
   r=next(r for r in self.report['leagues'] if r['league']==l);self.assertLess(r['split']['training']['end'],r['split']['calibration']['start']);self.assertLess(r['split']['calibration']['end'],r['split']['test']['start'])
  self.assertNotIn('cpbl.com.tw',json.dumps(self.report['leagues'][0]['source']))
 def test_same_day_and_future_scores_do_not_change_a_fixture_features(self):
  games=copy.deepcopy(self.games['CPBL']);before,_=model.reconstruct(games);target=next(r for r in before if r['date']>='2026-08-16')
  for g in games:
   if g['date']>=target['date']:g['homeScore']+=1
  after,_=model.reconstruct(games);other=next(r for r in after if r['id']==target['id']);self.assertEqual(target['x'],other['x'])
 def test_duplicates_conflicts_and_repeated_team_dates(self):
  gs=copy.deepcopy(self.games['CPBL']);self.assertEqual(model.normalize(gs),model.normalize(gs+[copy.deepcopy(gs[0])]))
  bad=copy.deepcopy(gs[0]);bad['homeScore']+=1
  with self.assertRaises(ValueError):model.normalize(gs+[bad])
  gs=copy.deepcopy(self.games['CPBL']);duplicate=copy.deepcopy(gs[-1]);duplicate['id']='second-game';rows,_=model.reconstruct(gs+[duplicate]);self.assertFalse(any(r['id'] in [duplicate['id'],gs[-1]['id']] for r in rows))
 def test_report_metrics_recompute_from_untouched_test_predictions_and_no_promotion(self):
  self.assertFalse(self.report['productionCalibrated'])
  for r in self.report['leagues']:
   rows=[p for p in self.pred if p['league']==r['league']];y=np.array([model.CLASSES.index(p['actual']) for p in rows]);p=np.array([p['calibrated'] for p in rows]);m=model.metrics(y,p)
   self.assertEqual(len(rows),r['split']['test']['games']);self.assertTrue(np.allclose(p.sum(1),1));self.assertAlmostEqual(m['brier'],r['calibrated']['brier']);self.assertAlmostEqual(m['logLoss'],r['calibrated']['logLoss']);self.assertFalse(r['gate']['applied']);self.assertFalse(r['gate']['productionEquivalent'])
 def test_changing_test_labels_cannot_retrain_or_recalibrate(self):
  games=copy.deepcopy(self.games['CPBL'])
  for g in games:
   if g['date']>='2026-08-16':g['homeScore'],g['awayScore']=g['awayScore'],g['homeScore']
  # Later rolling features may change; training and calibration parameters may not.
  result,_=model.evaluate('CPBL',games,self.sources['CPBL']);original=self.report['leagues'][0]
  self.assertAlmostEqual(result['temperature'],original['temperature']);self.assertEqual(result['model'],original['model'])
 def test_sql_immutable_slots_and_latest_pregame_cutoff(self):
  db=sqlite3.connect(':memory:');db.executescript(Path('drizzle/0012_curvy_rocket_raccoon.sql').read_text())
  def insert(id,captured,payload):db.execute('INSERT INTO international_forecasts VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',(id,'NPB','fixture','2026-09-21','2026-09-21T09:00:00.000Z',captured,'v1',json.dumps({'startTime':'2026-09-21T09:00:00.000Z','value':payload})))
  insert('first','2026-09-21T08:00:00.000Z',1);insert('first','2026-09-21T08:01:00.000Z',9);insert('last','2026-09-21T08:58:00.000Z',2);insert('late','2026-09-21T08:59:30.000Z',3)
  self.assertEqual(json.loads(db.execute("SELECT payload FROM international_forecasts WHERE id='first'").fetchone()[0])['value'],1)
  code=Path('lib/international-model-audit-store.ts').read_text();query=re.search(r'`(SELECT payload FROM \(SELECT payload,ROW_NUMBER\(\).*?LIMIT 2001)`',code,re.S).group(1)
  results=db.execute(query,('2026-09-20T00:00:00.000Z',)).fetchall();self.assertEqual(len(results),1);self.assertEqual(json.loads(results[0][0])['value'],2)
if __name__=='__main__':unittest.main()
