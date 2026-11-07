"""Fit only on 2014–2020. Freeze the coefficients before scoring both later windows.

Run node scripts/football-context-features.mjs, then run this file from the repo.
The last, already inspected 85 games are deliberately outside the input archive.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.optimize import minimize

ROOT = Path(__file__).resolve().parents[1]
FEATURES = ROOT / '.football-research/context-features.json'
ARCHIVE = ROOT / 'data/football/market-history-20260928.json'
rows = json.loads(FEATURES.read_text())
archive = json.loads(ARCHIVE.read_text())
periods = {'fit': ('2014', '2021'), 'holdout': ('2021', '2025'),
           'replication': ('2025', '2027')}

def observations(sample):
    home = np.array([r['homeScore'] for r in sample])
    away = np.array([r['awayScore'] for r in sample])
    return np.where(home > away, 0, np.where(home == away, 1, 2)), (home + away > 2), (home * away > 0)

def features(sample):
    return np.array([[r['form'], np.clip(r['residual'], -2, 2), float(not r['neutral'])] for r in sample])

def multipliers(x, params):
    direction = np.clip(x @ params[:3], -.65, .65)
    return np.exp(np.column_stack([direction, np.full(len(x), params[3]), -direction]))

def fit(sample):
    old = np.array([r['old'] for r in sample])
    y, _, _ = observations(sample)
    x = features(sample)
    def objective(params):
        mass = old * multipliers(x, params)
        p = mass[np.arange(len(y)), y] / mass.sum(axis=1)
        return -np.mean(np.log(p)) + .002 * np.dot(params, params)
    result = minimize(objective, np.zeros(4), method='L-BFGS-B',
                      bounds=[(0, .6), (0, .8), (-.25, .25), (-.3, .3)])
    if not result.success:
        raise RuntimeError(result.message)
    return result.x

def score(p, over, btts, truths):
    y, yo, yb = truths
    return dict(n=len(y), hits=int((p.argmax(axis=1) == y).sum()),
                logLoss=float(-np.log(p[np.arange(len(y)), y]).mean()),
                brier=float(((p-np.eye(3)[y])**2).sum(axis=1).mean()),
                over25Brier=float(((over-yo)**2).mean()), bttsBrier=float(((btts-yb)**2).mean()))

def compare(sample, params):
    truths = observations(sample)
    arr = lambda name: np.array([r[name] for r in sample])
    old, over, btts = arr('old'), arr('over'), arr('btts')
    weights = multipliers(features(sample), params)
    total = (old * weights).sum(axis=1)
    return {'base': score(old, over.sum(axis=1), btts.sum(axis=1), truths),
            'v1': score(arr('v1'), arr('v1Over'), arr('v1Btts'), truths),
            'challenger': score(old*weights/total[:,None], (over*weights).sum(axis=1)/total,
                                (btts*weights).sum(axis=1)/total, truths)}

def passes(b, c):
    return (c['n'] >= 250 and c['brier'] < b['brier'] and c['logLoss'] < b['logLoss']
            and c['hits'] >= b['hits'] - .01*c['n']
            and c['over25Brier'] <= b['over25Brier']+.003 and c['bttsBrier'] <= b['bttsBrier']+.003)

out = {'baseVersion': 'football-market-v4-20260928', 'version': 'football-context-v2-20261107',
       'sourceFileSha256': hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(), 'sourceCutoff': archive['cutoff'],
       'periodsExclusiveEnd': periods, 'includesHistoricalInjuries': False, 'leagues': {}}
for league in ['ger.1', 'ita.1']:
    splits = {s:[r for r in rows if r['league'] == league and lo <= r['start'] < hi]
              for s,(lo,hi) in periods.items()}
    params = fit(splits['fit'])
    metrics = {s:compare(data, params) for s,data in splits.items()}
    checks = [metrics['holdout'], metrics['replication']]
    if all(passes(m[base], m['challenger']) for m in checks for base in ('base','v1')):
        selection = 'challenger'
    elif all(passes(m['base'], m['v1']) for m in checks):
        selection = 'v1'
    else:
        selection = 'base'
    out['leagues'][league] = {'selection': selection, 'parameters': dict(zip(['form','margin','home','draw'], params)),
                               'metrics': metrics}
    print(league, selection, json.dumps(metrics), flush=True)
dest = ROOT / 'data/football/context-calibration-20261107.json'
dest.write_text(json.dumps(out, indent=2)+'\n')
