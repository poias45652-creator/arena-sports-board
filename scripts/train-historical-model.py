"""Fixed chronological experiment. Never tune on 2025; no current-season features or unverified odds."""
import json,hashlib,datetime
from pathlib import Path
import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression,PoissonRegressor
from sklearn.metrics import brier_score_loss,log_loss,mean_absolute_error
src=Path('data/retrosheet.json'); archive=json.loads(src.read_text())
# Only finished regular results with at least 20 prior games per team.
games=[g for g in archive['games'] if g['trainingEligible'] and min(g['pregame'][s]['games'] for s in ['home','away'])>=20]
def rate(t,k): return (t[k]+20*4.5)/(t['games']+20)
def features(g):
 p=g['pregame'];h,a=p['home'],p['away']
 return [(h['wins']+10)/(h['games']+20)-(a['wins']+10)/(a['games']+20),rate(h,'runsFor')-rate(a,'runsFor'),rate(h,'runsAgainst')-rate(a,'runsAgainst')]
def baseline(g):
 h,a=[(g['pregame'][s]['wins']+10)/(g['pregame'][s]['games']+20) for s in ['home','away']]
 return (h*(1-a))/(h*(1-a)+a*(1-h))
x=np.array([features(g) for g in games]); y=np.array([g['result']['home']>g['result']['away'] for g in games],dtype=int);years=np.array([g['season'] for g in games]); train=years==2023;cal=years==2024;test=years==2025
model=make_pipeline(StandardScaler(),LogisticRegression(C=1.0,max_iter=2000)).fit(x[train],y[train])
# Platt calibration fit exclusively on 2024 predictions. Fixed C, no holdout selection.
calibrator=LogisticRegression(C=1000000,max_iter=2000).fit(model.decision_function(x[cal]).reshape(-1,1),y[cal])
p=calibrator.predict_proba(model.decision_function(x[test]).reshape(-1,1))[:,1];raw=model.predict_proba(x[test])[:,1];b=np.array([baseline(g) for g,t in zip(games,test) if t]);target=y[test]
def metrics(v):return {'brier':float(brier_score_loss(target,v)),'logLoss':float(log_loss(target,v)),'accuracy':float(np.mean((v>=.5)==target))}
# Paired day-block bootstrap keeps same-day games together. Negative means candidate better.
testgames=[g for g,t in zip(games,test) if t]; dates=sorted(set(g['date'] for g in testgames)); delta=(p-target)**2-(b-target)**2;blocks=[delta[[g['date']==d for g in testgames]] for d in dates];rng=np.random.default_rng(20260910)
boot=[float(np.concatenate([blocks[i] for i in rng.integers(0,len(blocks),len(blocks))]).mean()) for _ in range(2000)]
ci=np.quantile(boot,[.025,.975]).tolist()
bins=[]
for lo,hi in zip(np.arange(0,1,.1),np.arange(.1,1.1,.1)):
 m=(p>=lo)&(p<hi);bins.append({'from':float(lo),'to':float(hi),'games':int(m.sum()),'meanPrediction':float(p[m].mean()) if m.any() else None,'homeWinRate':float(target[m].mean()) if m.any() else None})
# Separate team-score model. Final scores include extra innings; not an in-game model.
def scorex(g,s):
 o='away' if s=='home' else 'home';return [rate(g['pregame'][s],'runsFor'),rate(g['pregame'][o],'runsAgainst'),int(s=='home')]
sx=np.array([scorex(g,s) for g in games for s in ['away','home']]);sy=np.array([g['result'][s] for g in games for s in ['away','home']]);st=np.repeat(train,2);sc=np.repeat(cal,2);se=np.repeat(test,2)
scoremodel=make_pipeline(StandardScaler(),PoissonRegressor(alpha=1,max_iter=2000)).fit(sx[st],sy[st]);mult=float(sy[sc].sum()/scoremodel.predict(sx[sc]).sum());sp=scoremodel.predict(sx[se])*mult
report={'version':'historical-baseline-2023-2025-v1','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'scope':'Pregame team-record baseline; advanced Statcast, lineup, weather and odds NOT trained into this model','split':{str(z):{'role':r,'games':int((years==z).sum())} for z,r in [(2023,'training'),(2024,'calibration'),(2025,'untouched_test')]},'features':['shrunk_home_minus_away_win_rate','shrunk_home_minus_away_runs_for','shrunk_home_minus_away_runs_against'],'minimumPriorGames':20,'cutoff':'All input games completed before game calendar date; same-day doubleheaders excluded','test':{'baselineLog5':metrics(b),'uncalibratedLogistic':metrics(raw),'calibratedLogistic':metrics(p),'brierDifference95CI':ci,'bootstrap':'2000 paired day-block resamples, seed 20260910','calibrationBins':bins,'scoreMAE':float(mean_absolute_error(sy[se],sp))},'deployment':{'modelApplied':False,'status':'research_candidate','reason':'Requires broader season validation and point-in-time advanced inputs; no verified historical odds ROI'},'historicalOddsROI':None,'limitations':['One held-out season only','Completed-game selection excludes suspended, forfeited, protested, tied and shortened games','2026 Statcast cannot be used to predict 2025 games','No verified bookmaker, pregame price timestamps, total prices or run-line prices for betting evaluation'],'model':{'scalerMean':model[0].mean_.tolist(),'scalerScale':model[0].scale_.tolist(),'coefficients':model[1].coef_[0].tolist(),'intercept':float(model[1].intercept_[0]),'calibrationSlope':float(calibrator.coef_[0,0]),'calibrationIntercept':float(calibrator.intercept_[0])},'scoreModel':{'scalerMean':scoremodel[0].mean_.tolist(),'scalerScale':scoremodel[0].scale_.tolist(),'coefficients':scoremodel[1].coef_.tolist(),'intercept':float(scoremodel[1].intercept_),'calibrationMultiplier':mult}}
Path('data/model-validation.json').write_text(json.dumps(report,ensure_ascii=False,separators=(',',':')))
Path('data/historical-test-predictions.json').write_text(json.dumps([{'gameId':g['id'],'date':g['date'],'homeWin':int(t),'baseline':float(bb),'candidate':float(pp)} for g,t,bb,pp in zip(testgames,target,b,p)],separators=(',',':')))
print(json.dumps({'split':report['split'],'metrics':{k:v for k,v in report['test'].items() if k!='calibrationBins'}}))
