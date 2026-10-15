"""Independent Europa fit: identical Champions equations, frozen temporal gates."""
import datetime,hashlib,json,pathlib
import numpy as np
from scipy.optimize import minimize
from scipy.special import gammaln
from scipy.stats import poisson,skellam
ROOT=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'.football-research/europa-features.json').read_text())
protocol=json.loads((ROOT/'docs/football-europa-protocol.json').read_text())
def fitted_rates(theta,x):
 ih,ia,ga,gd,xa,xd,elo,rho=theta
 hi=np.where(x[:,9]>0,(ih+ia)/2,ih);ai=np.where(x[:,9]>0,(ih+ia)/2,ia)
 h=np.clip(np.exp(hi+ga*np.log(x[:,0]+.1)+gd*np.log(x[:,3]+.1)+xa*np.log(x[:,4]+.1)+xd*np.log(x[:,7]+.1)+elo*x[:,8]),.15,5)
 a=np.clip(np.exp(ai+ga*np.log(x[:,2]+.1)+gd*np.log(x[:,1]+.1)+xa*np.log(x[:,6]+.1)+xd*np.log(x[:,5]+.1)-elo*x[:,8]),.15,5)
 return h,a,np.full(len(x),rho)

def safe_rho(h,a,r):return np.clip(r,-np.minimum(1/h,1/a)+1e-6,np.minimum(1-1e-6,1/(h*a)-1e-6))
def probabilities(h,a,r):
 r=safe_rho(h,a,r);q=np.exp(-h-a)*h*a*r
 return np.column_stack([skellam.sf(0,h,a)+q,skellam.pmf(0,h,a)-2*q,skellam.cdf(-1,h,a)+q]),poisson.sf(2,h+a),(1-np.exp(-h))*(1-np.exp(-a))-q
def fit(rows,index,has_xg):
 x=np.array([r['variants'][index] for r in rows]);home=np.array([r['homeScore'] for r in rows]);away=np.array([r['awayScore'] for r in rows])
 def objective(theta):
  h,a,r=fitted_rates(theta,x);r=safe_rho(h,a,r);tau=np.ones(len(x))
  for mask,value in [((home==0)&(away==0),1-h*a*r),((home==0)&(away==1),1+h*r),((home==1)&(away==0),1+a*r),((home==1)&(away==1),1-r)]:tau[mask]=value[mask]
  nll=h-home*np.log(h)+gammaln(home+1)+a-away*np.log(a)+gammaln(away+1)-np.log(np.maximum(tau,1e-12))
  return float(nll.mean()+.01*np.square(theta[2:7]).sum()+.01*theta[7]**2)
 initial=[0,0,.3 if has_xg else .6,.3 if has_xg else .6,.3 if has_xg else 0,.3 if has_xg else 0,.1,-.05]
 bounds=[(-1,1),(-1,1),(0,1.5),(0,1.5),(0,1.5) if has_xg else (0,0),(0,1.5) if has_xg else (0,0),(0,1.5),(-.2,.2)]
 result=minimize(objective,initial,method='L-BFGS-B',bounds=bounds,options={'maxiter':600,'ftol':1e-11})
 if not result.success:raise RuntimeError(result.message)
 return result.x
def evaluate(rows,index=None,theta=None,blend=1):
 base=np.array([r['variants'][1] for r in rows]);bh=np.clip((base[:,0]+base[:,3])/2,.15,5);ba=np.clip((base[:,2]+base[:,1])/2,.15,5)
 if theta is None:
  h=bh.copy();a=ba.copy();rho=np.zeros(len(rows))
  for i,r in enumerate(rows):
   if r['deployed'] is not None:h[i],a[i],rho[i]=r['deployed']
 else:
  x=np.array([r['variants'][index] for r in rows]);h,a,rho=fitted_rates(theta,x);h=blend*h+(1-blend)*bh;a=blend*a+(1-blend)*ba;rho=rho*blend
 p,over,btts=probabilities(h,a,rho);home=np.array([r['homeScore'] for r in rows]);away=np.array([r['awayScore'] for r in rows]);y=np.where(home>away,0,np.where(home<away,2,1));one=np.eye(3)[y];ll=-np.log(np.maximum(p[np.arange(len(rows)),y],1e-12))
 metrics={'n':len(rows),'logLoss':float(ll.mean()),'brier':float(((p-one)**2).sum(axis=1).mean()),'accuracy':float((p.argmax(axis=1)==y).mean()),'over25Brier':float(((over-(home+away>2))**2).mean()),'bttsBrier':float(((btts-((home>0)&(away>0)))**2).mean())}
 return metrics,ll,(h,a,rho),(p,over,btts)
def bootstrap(rows,delta):
 groups={}
 for r,d in zip(rows,delta):
  key=datetime.datetime.fromisoformat(r['start'].replace('Z','+00:00')).strftime('%G-%V');groups.setdefault(key,[]).append(float(d))
 stats=np.array([[sum(v),len(v)] for v in groups.values()]);rng=np.random.default_rng(20260927);draws=stats[rng.integers(0,len(stats),size=(1000,len(stats)))].sum(axis=1)
 return [float(v) for v in np.quantile(draws[:,0]/draws[:,1],[.025,.975])]
def fails(base,candidate):
 reasons=[]
 if candidate['logLoss']>=base['logLoss']:reasons.append('logloss_not_improved')
 if candidate['brier']>base['brier']:reasons.append('brier_worse')
 for name in ['over25Brier','bttsBrier']:
  if candidate[name]-base[name]>.002:reasons.append(name+'_worse')
 return reasons

def split_rows(rows):
 return {'training':[r for r in rows if '2012-01-01'<=r['start']<'2017-01-01'],
         'selection':[r for r in rows if '2017-01-01'<=r['start']<'2019-01-01'],
         'holdout':[r for r in rows if '2019-01-01'<=r['start']<'2021-01-01'],
         'audit2025':[r for r in rows if '2025-01-01'<=r['start']<'2026-01-01'],
         'audit2026':[r for r in rows if r['start']>='2026-01-01']}

splits=split_rows(data['rows']);candidates=[];base_selection=evaluate(splits['selection'])[0]
for index,option in enumerate(data['options']):
 theta=fit(splits['training'],index,False)
 for blend in protocol['candidates']['baselineBlend']:
  metric=evaluate(splits['selection'],index,theta,blend)[0]
  candidates.append({'option':option,'index':index,'theta':theta.tolist(),'blend':blend,'selectionMetrics':metric,'selectionReasons':fails(base_selection,metric)})
eligible=[c for c in candidates if not c['selectionReasons']]
winner=min(eligible or candidates,key=lambda c:c['selectionMetrics']['logLoss'])
parameters={**winner['option'],'blend':winner['blend'],**dict(zip(['homeIntercept','awayIntercept','goalAttack','goalDefense','xgAttack','xgDefense','elo','rho'],winner['theta'])),'usesXg':False}
reports={};reasons=[]
for name,rows in splits.items():
 if not rows:reasons.append(name+'_sample_small');continue
 b,bll,_,_=evaluate(rows);c,cll,_,_=evaluate(rows,winner['index'],winner['theta'],winner['blend']);reports[name]={'baseline':b,'candidate':c,'logLossChange':c['logLoss']-b['logLoss']}
 if name!='training':
  reasons.extend(name+'_'+r for r in fails(b,c));reports[name]['logLossChangeCI95']=bootstrap(rows,cll-bll)
gate=protocol['promotion']
for name,minimum in [('training',gate['minimumTrainingGames']),('selection',gate['minimumSelectionGames']),('holdout',gate['minimumHoldoutGames']),('audit2025',gate['minimumAuditGames']),('audit2026',gate['minimumAuditGames'])]:
 if len(splits[name])<minimum:reasons.append(name+'_sample_small')
full={'enabled':not reasons,'reasons':reasons,'parameters':parameters,'sampleSizes':{k:len(v) for k,v in splits.items()},'metrics':reports,'selectionCandidates':candidates}

# Sparse branch is audited separately. The regression coefficients remain fixed
# from complete-history training; only the predeclared prior is selected here.
sparse_splits=split_rows(data['sparse']);stats={};sparse_reasons=[]
for name,rows in sparse_splits.items():
 if name=='training' or not rows:continue
 stats[name]={'rawGoals':evaluate(rows)[0]}
 for n in protocol['candidates']['sparsePriorMatches']:
  transformed=[{**r,'variants':r['priors'][str(n)]} for r in rows]
  # Runtime sparse rates blend against the same shrunk values, as in Champions.
  # Match evaluate()'s baseline index to the selected option for exact parity.
  transformed=[{**r,'variants':[r['variants'][winner['index']]]*len(data['options'])} for r in transformed]
  stats[name]['prior'+str(n)]=evaluate(transformed,winner['index'],winner['theta'],winner['blend'])[0]
selected=min(protocol['candidates']['sparsePriorMatches'],key=lambda n:stats['selection']['prior'+str(n)]['logLoss'])
for name in ['selection','holdout','audit2025','audit2026']:
 minimum=protocol['sparsePromotion']['minimumSelectionGames' if name=='selection' else 'minimumHoldoutGames' if name=='holdout' else 'minimumAuditGames']
 group=stats.get(name)
 if not group or group['rawGoals']['n']<minimum:sparse_reasons.append(name+'_sample_small')
 if group:
  b=group['rawGoals'];c=group['prior'+str(selected)]
  if c['logLoss']>=b['logLoss']:sparse_reasons.append(name+'_logloss_not_improved')
  if c['brier']>b['brier']:sparse_reasons.append(name+'_brier_worse')
sparse={'enabled':not sparse_reasons,'reasons':sparse_reasons,'priorMatches':selected,'parameters':parameters,'stats':stats,'sampleSizes':{k:len(v) for k,v in sparse_splits.items()}}
# Keep the failed promotion result. An explicit post-coverage decision permits
# only the same observational baseline used by Champions when 2026 has no
# settled sparse fixtures; it never labels this branch as calibrated/applied.
sparse['observationEnabled']=full['enabled'] and sparse_reasons==['audit2026_sample_small'] and len(sparse_splits['audit2026'])==0
created=datetime.datetime.now(datetime.timezone.utc)
artifact={'version':protocol['version'],'createdAt':created.isoformat(),'expiresAt':(created+datetime.timedelta(days=90)).isoformat(),'sourceSha256':data['sourceSha256'],'protocolSha256':hashlib.sha256((ROOT/'docs/football-europa-protocol.json').read_bytes()).hexdigest(),'full':full,'sparse':sparse}
(ROOT/'docs/football-europa-calibration-audit.json').write_text(json.dumps(artifact,ensure_ascii=False,indent=2)+'\n')
runtime={**artifact,'full':{k:v for k,v in full.items() if k!='selectionCandidates'}}
(ROOT/'data/football/europa-calibration-runtime.json').write_text(json.dumps(runtime,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'full':{'enabled':full['enabled'],'reasons':reasons,'samples':full['sampleSizes'],'metrics':reports},'sparse':sparse},indent=2))

