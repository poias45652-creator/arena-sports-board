"""Frozen chronological team baseline, NEVER relabelled as the production pitching model."""
import collections, datetime, hashlib, json
from pathlib import Path
import numpy as np
from scipy.optimize import minimize_scalar
from scipy.special import softmax
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

CUTOFF='2026-09-20'
FEATURES=['home_minus_away_win_share','home_minus_away_runs_for','away_minus_home_runs_against','home_venue_minus_away_venue_runs_for','away_venue_minus_home_venue_runs_against','home_recent10_minus_away_recent10_runs_for','away_recent10_minus_home_recent10_runs_against']
SOURCE_FILES=['data/cpbl-game-logs-20260920.json','data/international-profile-2026.json']
CLASSES=['away','home','draw']

def load_games():
 cp=json.loads(Path(SOURCE_FILES[0]).read_text()); profiles=json.loads(Path(SOURCE_FILES[1]).read_text())['games']
 out={'CPBL':[dict(id=g['key'],date=g['date'],home=g['home'],away=g['away'],homeScore=g['homeScore'],awayScore=g['awayScore']) for g in cp['games']]}
 source={'CPBL':dict(observedAt=cp['observedAt'],urls=[s['url'] for s in cp['sources']])}
 for league in ['NPB','KBO']:
  s=profiles[league]
  if s['warnings']:raise ValueError('Incomplete history: '+league)
  out[league]=[dict(id=str(g['id']),date=g['date'],home=str(g['homeId']),away=str(g['awayId']),homeScore=g['homeScore'],awayScore=g['awayScore']) for g in s['games'] if g['season']==2026 and g['completed'] and g['state']=='Final']
  source[league]=dict(observedAt=s['fetchedAt'],urls=[x['url'] for x in s['sources']])
 return out,source

def normalize(games):
 seen={}
 for g in games:
  if g['date']>=CUTOFF:continue
  if not g['date'].startswith('2026-') or g['home']==g['away'] or any(type(g[s+'Score']) is not int or not 0<=g[s+'Score']<=100 for s in ['home','away']):raise ValueError('Invalid final game')
  if g['id'] in seen and seen[g['id']]!=g:raise ValueError('Conflicting final fixture '+g['id'])
  seen[g['id']]=g
 return sorted(seen.values(),key=lambda g:(g['date'],g['id']))

def reconstruct(games):
 history=collections.defaultdict(list);features=[];excluded=collections.Counter()
 grouped=collections.defaultdict(list)
 for g in normalize(games):grouped[g['date']].append(g)
 def summarize(rows):
  n=len(rows)
  return [(sum(x['points'] for x in rows)+10)/(n+20),(sum(x['rf'] for x in rows)+90)/(n+20),(sum(x['ra'] for x in rows)+90)/(n+20)]
 for day,fixtures in sorted(grouped.items()):
  counts=collections.Counter(t for g in fixtures for t in [g['home'],g['away']])
  for g in fixtures:
   h,a=history[g['home']],history[g['away']]
   if counts[g['home']]>1 or counts[g['away']]>1:excluded['sameDayRepeatedTeam']+=1;continue
   if min(len(h),len(a))<20:excluded['warmupUnder20']+=1;continue
   assert all(r['date']<day for r in h+a)
   sh,sa=summarize(h),summarize(a)
   vh,va=summarize([r for r in h if r['home']]),summarize([r for r in a if not r['home']])
   rh,ra=summarize(h[-10:]),summarize(a[-10:])
   x=[sh[0]-sa[0],sh[1]-sa[1],sa[2]-sh[2],vh[1]-va[1],va[2]-vh[2],rh[1]-ra[1],ra[2]-rh[2]]
   y=1 if g['homeScore']>g['awayScore'] else 0 if g['homeScore']<g['awayScore'] else 2
   features.append(dict(**g,x=x,y=y,priorGames=dict(home=len(h),away=len(a)),inputThroughDate=max(r['date'] for r in h+a)))
  for g in fixtures:
   for side in ['home','away']:
    other='away' if side=='home' else 'home';rf,ra=g[side+'Score'],g[other+'Score']
    history[g[side]].append(dict(date=day,rf=rf,ra=ra,points=1 if rf>ra else 0 if rf<ra else .5,home=side=='home'))
 return features,dict(excluded)

def metrics(y,p):
 one=np.eye(3)[y];bins=[];ece=[]
 for c in range(3):
  rows=[];err=0
  for k in range(5):
   lo,hi=k/5,(k+1)/5;mask=(p[:,c]>=lo)&((p[:,c]<hi) if k<4 else (p[:,c]<=hi));n=int(mask.sum())
   expected=float(p[mask,c].mean()) if n else None;actual=float((y[mask]==c).mean()) if n else None
   if n:err+=n/len(y)*abs(expected-actual)
   rows.append(dict(fromProbability=lo,toProbability=hi,games=n,meanPrediction=expected,observedRate=actual))
  bins.append(dict(outcome=CLASSES[c],bins=rows));ece.append(err)
 return dict(brier=float(np.mean(np.sum((p-one)**2,axis=1))),logLoss=float(-np.log(np.clip(p[np.arange(len(y)),y],1e-15,1)).mean()),accuracy=float((p.argmax(1)==y).mean()),macroECE=float(np.mean(ece)),reliability=bins)

def bootstrap(rows,delta):
 days=sorted({r['date'] for r in rows});blocks=[delta[[r['date']==d for r in rows]] for d in days];rng=np.random.default_rng(20260920)
 samples=[np.concatenate([blocks[i] for i in rng.integers(0,len(blocks),len(blocks))]).mean() for _ in range(2000)]
 return [float(x) for x in np.quantile(samples,[.025,.975])]

def evaluate(league,games,source):
 rows,excluded=reconstruct(games);x=np.array([r['x'] for r in rows]);y=np.array([r['y'] for r in rows]);dates=np.array([r['date'] for r in rows])
 train=dates<'2026-07-01';cal=(dates>='2026-07-01')&(dates<'2026-08-16');test=dates>='2026-08-16'
 if len(set(y[train]))!=3:raise ValueError(league+' missing a training result class')
 scaler=StandardScaler().fit(x[train]);model=LogisticRegression(C=.2,max_iter=2000).fit(scaler.transform(x[train]),y[train]);assert list(model.classes_)==[0,1,2]
 logits=model.decision_function(scaler.transform(x));cal_logits=logits[cal];cy=y[cal]
 objective=lambda logt:float(-np.log(np.clip(softmax(cal_logits/np.exp(logt),axis=1)[np.arange(len(cy)),cy],1e-15,1)).mean())
 fit=minimize_scalar(objective,bounds=(np.log(.5),np.log(3)),method='bounded',options={'xatol':1e-10})
 if not fit.success:raise RuntimeError('Temperature optimization failed')
 temp=float(np.exp(fit.x));raw=softmax(logits[test],axis=1);pred=softmax(logits[test]/temp,axis=1);target=y[test]
 freq=(np.bincount(y[train],minlength=3)+1)/(int(train.sum())+3);baseline=np.tile(freq,(len(target),1));target_one=np.eye(3)[target]
 raw_loss=np.sum((raw-target_one)**2,axis=1);pred_loss=np.sum((pred-target_one)**2,axis=1);base_loss=np.sum((baseline-target_one)**2,axis=1)
 tests=[r for r,m in zip(rows,test) if m];ci=bootstrap(tests,pred_loss-raw_loss);base_ci=bootstrap(tests,pred_loss-base_loss)
 rawmetrics,calmetrics,basemetrics=metrics(target,raw),metrics(target,pred),metrics(target,baseline)
 splits={}
 for name,m in [('training',train),('calibration',cal),('test',test)]:splits[name]=dict(games=int(m.sum()),start=min(dates[m]),end=max(dates[m]),results={c:int((y[m]==i).sum()) for i,c in enumerate(CLASSES)})
 enough=splits['training']['games']>=100 and splits['calibration']['games']>=60 and splits['test']['games']>=60 and all(s['results']['draw']>=3 for s in splits.values())
 improved=ci[1]<0 and base_ci[1]<0 and calmetrics['logLoss']<=min(rawmetrics['logLoss'],basemetrics['logLoss'])
 report=dict(league=league,version='team-record-softmax-temperature-v1',source=source,sourceGames=len(normalize(games)),eligibleGames=len(rows),exclusions=excluded,split=splits,
  baseline=basemetrics,uncalibrated=rawmetrics,calibrated=calmetrics,brierDifference95CI=ci,brierVsBaseline95CI=base_ci,temperature=temp,
  model=dict(scalerMean=scaler.mean_.tolist(),scalerScale=scaler.scale_.tolist(),coefficients=model.coef_.tolist(),intercept=model.intercept_.tolist(),classes=CLASSES),
  gate=dict(samplePassed=bool(enough),improvementPassed=bool(improved),productionEquivalent=False,applied=False,status='research_only',reason='歷史先發／牛棚快照不齊，研究模型與前台模型不同，校準參數不套入前台。'))
 predictions=[dict(league=league,id=r['id'],date=r['date'],inputThroughDate=r['inputThroughDate'],priorGames=r['priorGames'],home=r['home'],away=r['away'],actual=CLASSES[r['y']],result=dict(home=r['homeScore'],away=r['awayScore']),raw=raw[i].tolist(),calibrated=pred[i].tolist(),baseline=baseline[i].tolist()) for i,r in enumerate(tests)]
 return report,predictions

def main():
 games,sources=load_games();reports=[];predictions=[]
 for league in ['CPBL','NPB','KBO']:
  r,p=evaluate(league,games[league],sources[league]);reports.append(r);predictions+=p
  print(json.dumps(dict(league=league,sourceGames=r['sourceGames'],split=r['split'],temperature=r['temperature'],brier={k:r[k]['brier'] for k in ['baseline','uncalibrated','calibrated']},ci=r['brierDifference95CI'],gate=r['gate']),ensure_ascii=False))
 report=dict(schemaVersion=1,createdAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),protocolVersion='20260920-fixed-v1',scope='retrospective_team_baseline_only',productionCalibrated=False,cutoffExclusive=CUTOFF,features=FEATURES,classes=CLASSES,
  inputHashes={p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in SOURCE_FILES},scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),protocolSha256=hashlib.sha256(Path('docs/international-validation-protocol.md').read_bytes()).hexdigest(),
  software=dict(numpy=np.__version__,sklearn=__import__('sklearn').__version__,scipy=__import__('scipy').__version__),bootstrap=dict(samples=2000,unit='date',seed=20260920),
  unsupported=['完整先發與牛棚模型回測','上半場與七種玩法校準','具賽前時間戳的歷史盤口報酬率','原始當時來源版本與臨場先發異動'],leagues=reports)
 Path('data/international-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 Path('server/research-data/international-backtest-predictions.json').write_text(json.dumps(predictions,ensure_ascii=False,separators=(',',':'))+'\n')

if __name__=='__main__':main()
