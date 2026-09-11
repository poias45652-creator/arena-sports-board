import json,unittest,math
from pathlib import Path
class ResearchIntegrity(unittest.TestCase):
 def test_holdout_is_disjoint_and_predictions_reproduce(self):
  r=json.loads(Path('data/model-validation.json').read_text());pred=json.loads(Path('data/historical-test-predictions.json').read_text());g={g['id']:g for g in json.loads(Path('data/retrosheet.json').read_text())['games']};m=r['model']
  self.assertEqual(len(pred),2113);self.assertEqual(len(set(p['gameId'] for p in pred)),len(pred))
  for p in pred:
   row=g[p['gameId']];self.assertEqual(row['season'],2025);self.assertEqual(row['pregame']['cutoffExclusive'],row['date']);h,a=[row['pregame'][s] for s in ['home','away']]
   rate=lambda t,k:(t[k]+90)/(t['games']+20)
   x=[(h['wins']+10)/(h['games']+20)-(a['wins']+10)/(a['games']+20),rate(h,'runsFor')-rate(a,'runsFor'),rate(h,'runsAgainst')-rate(a,'runsAgainst')]
   z=sum((v-mu)/s*w for v,mu,s,w in zip(x,m['scalerMean'],m['scalerScale'],m['coefficients']))+m['intercept'];prob=1/(1+math.exp(-(z*m['calibrationSlope']+m['calibrationIntercept'])))
   self.assertAlmostEqual(prob,p['candidate'],places=12)
  self.assertAlmostEqual(sum((p['candidate']-p['homeWin'])**2 for p in pred)/len(pred),r['test']['calibratedLogistic']['brier'])
  self.assertFalse(r['deployment']['modelApplied'])
 def test_odds_join_preserves_unknown_timing(self):
  d=json.loads(Path('data/historical-odds.json').read_text());self.assertEqual(len(d['games']),413);self.assertEqual(len(set(p['gameId'] for p in d['games'])),413)
  for p in d['games']:
   self.assertTrue(p['hasStatcast']);self.assertIsNone(p['priceTimestamp']);self.assertFalse(p['roiEligible']);self.assertFalse(p['pregameEligibilityVerified'])
  self.assertEqual(d['summary']['roiEligibleGames'],0)
if __name__=='__main__':unittest.main()
