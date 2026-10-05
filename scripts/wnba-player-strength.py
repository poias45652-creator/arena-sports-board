"""WNBA calibration/refresh of the shared NBA individual-production algorithm.

Uses only WNBA identities and boxes, 40 regulation minutes and 200 team minutes.
2023 warms up, 2024 trains, 2025 tunes, and 2026 is held out chronologically.
"""
import argparse, importlib.util, json, math, re, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('basketball_training',ROOT/'scripts/nba-player-strength.py')
core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
core.LEAGUE='WNBA';core.LEAGUE_ID=59;core.REGULATION=40
core.TEAM_IDS={'20','19','18','3','129689','5','17','6','8','9','11','132052','14','131935','16'}

def source(url,limit):
    with urllib.request.urlopen(url,timeout=40) as r:data=r.read(limit+1)
    if len(data)>limit:raise ValueError('WNBA source too large')
    return data

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--train',action='store_true');ap.add_argument('--refresh',action='store_true');args=ap.parse_args()
    folder=ROOT/'evidence/wnba';folder.mkdir(parents=True,exist_ok=True)
    now=datetime.now(timezone.utc).timestamp();end=datetime.now(timezone.utc).year
    years=list(range(2023,2027)) if args.train else [end-1,end]
    if args.refresh:
        def download(job):
            year,kind=job
            url=f'https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_wnba_{"player_boxscores" if kind=="players" else "schedules"}/{"player_box" if kind=="players" else "wnba_schedule"}_{year}.csv'
            try:data=source(url,30000000)
            except urllib.error.HTTPError as e:
                if year==end and e.code==404:return (year,False)
                raise
            name=('player-csv.csv' if kind=='players' else 'schedule.csv') if year==2026 else f'{kind}-{year}.csv'
            (folder/name).write_bytes(data);return (year,True)
        with ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(download,[(y,k) for y in years for k in ['schedule','players']]))
        years=[y for y in years if all(ok for year,ok in results if year==y)]
        if end not in years:raise ValueError('Current WNBA season source unavailable')
        previous=json.loads((ROOT/'data/wnba-player-strength.json').read_text())
    else:
        directory=json.loads((folder/'players.json').read_text())
        page=directory['props']['pageProps']
        if int(page['defaultSeason'])!=end or len(page['currentPlayersData'])<100:raise ValueError('WNBA identity season mismatch')
        index=[{'PERSON_ID':r[0],'PLAYER_FIRST_NAME':r[2],'PLAYER_LAST_NAME':r[1]} for r in page['currentPlayersData']]
        if len({r['PERSON_ID'] for r in index})!=len(index):raise ValueError('duplicate WNBA identity')
    games,names=core.read_games(folder,years);games=[g for g in games if g['at']+6*3600<now]
    if len(games)<400:raise ValueError('insufficient verified WNBA history')
    if args.refresh:
        # Reuse only stable, verified ID/name pairs; recompute every statistic
        # from the newly downloaded, validated current-season boxes.
        index,identity_verified_at=core.verified_identity_index(previous,names,now)
    samples,hist,players=core.chronological(games)
    model=None
    if args.train:
        train=[r for r in samples if r['year']==2024];tune=[r for r in samples if r['year']==2025];test=[r for r in samples if r['year']==2026]
        if min(map(len,[train,tune,test]))<150:raise ValueError('insufficient chronological validation')
        selected=[]
        for alpha in [10,30,100,300]:
            co=core.fit(train,alpha);sigma=math.sqrt(sum((r['y']-sum(a*b for a,b in zip(r['x'],co)))**2 for r in tune)/len(tune))
            selected.append((core.metrics(tune,co,sigma)['logLoss'],alpha,sigma))
        _,alpha,sigma=min(selected);co=core.fit(train+tune,alpha)
        result=core.metrics(test,co,sigma);baseline=core.metrics(test,[2.5,0,.5,0,0],10.5)
        beats_reference=result['brier']<baseline['brier'] and result['logLoss']<baseline['logLoss']
        # Operational availability is distinct from evidence of improvement.
        # Publish requested rotation estimates without claiming validation.
        model={'version':'wnba-player-opponent-v3','features':['homeVenue','playerProductionDiff','recentNetDiff','opponentNetDiff','restDiff'],'coefficients':co,'sigma':sigma,'enabled':True,'regularSeasonValidated':beats_reference,'beatsReference':beats_reference,'validationScope':'historical previous-rotation minutes; excludes live news and preseason scenarios; live output is a scenario estimate','preseasonValidated':False,'alpha':alpha,'trainedSeasons':[2024,2025],'holdoutSeason':2026,'validation':result,'referenceRecentNet':baseline,'createdAt':datetime.fromtimestamp(now,timezone.utc).isoformat()}
        print(json.dumps(model),flush=True)
    snapshot=core.snapshot(hist,players,names,index,now)
    if args.refresh:snapshot['identitySourceCapturedAt']=identity_verified_at
    if len(snapshot['players'])<100 or len(snapshot['teams'])<12:raise ValueError('WNBA snapshot coverage insufficient')
    # Validate everything before replacing either committed output.
    for name,value in [('wnba-player-model',model),('wnba-player-strength',snapshot)]:
        if value is None:continue
        target=ROOT/'data'/f'{name}.json';target.parent.mkdir(exist_ok=True)
        tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n');tmp.replace(target)
    print(json.dumps({'games':len(games),'players':len(snapshot['players']),'teams':len(snapshot['teams']),'unmatchedCount':len(snapshot['unmatchedNames'])}),flush=True)

if __name__=='__main__':main()
