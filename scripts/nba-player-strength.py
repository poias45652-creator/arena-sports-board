"""Chronological NBA player-production model; no odds used as model inputs.

Historical roster/minutes: previous ten team games only, never the target box.
Current roster: NBA.com IDs; exact normalized names join the documented ESPN
SportsDataverse player archive. Ambiguous names are excluded, never fuzzy joined.
"""
import csv, json, math, re, unicodedata, argparse, urllib.request, urllib.error, itertools
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

ROOT=Path(__file__).resolve().parents[1]
DAY=86400
LEAGUE='NBA'
LEAGUE_ID=46
REGULATION=48
TEAM_IDS={str(i) for i in range(1,31)}
def timestamp(s): return datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def name_key(s):
    s=''.join(c for c in unicodedata.normalize('NFKD',s) if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z0-9]','',re.sub(r'\b(jr|sr|ii|iii|iv)\b','',s))
def num(r,k):
    v=float(r[k]); assert math.isfinite(v); return v
def read_games(folder,years):
    fixtures={}; boxes=defaultdict(dict); names={}
    for year in years:
        sp=folder/('schedule.csv' if year==2026 else f'schedule-{year}.csv')
        pp=folder/('player-csv.csv' if year==2026 else f'players-{year}.csv')
        for r in csv.DictReader(sp.open()):
            if r['season_type'] not in ['2','3'] or r['status_type_completed'].lower()!='true': continue
            if r['home_id'] not in TEAM_IDS or r['away_id'] not in TEAM_IDS:continue
            if not r['status_type_name'].startswith('STATUS_FINAL'): continue
            if not all(r[s+'_uid']==f's:40~l:{LEAGUE_ID}~t:{r[s+"_id"]}' for s in ['home','away']):continue
            h,a=int(r['home_score']),int(r['away_score'])
            if h<=0 or a<=0 or h==a: continue
            fixtures[r['id']]={'id':r['id'],'at':timestamp(r['date']),'home':r['home_id'],'away':r['away_id'],'h':h,'a':a,'neutral':r['neutral_site'].lower()=='true','year':year,'period':int(float(r['status_period']))}
        for r in csv.DictReader(pp.open()):
            g=fixtures.get(r['game_id']);side=r['home_away']
            if not g or side not in ['home','away'] or r['did_not_play'].lower()=='true': continue
            try:
                m=num(r,'minutes')
                if m<=0:continue
                assert r['team_id']==g[side] and r['team_uid']==f's:40~l:{LEAGUE_ID}~t:{r["team_id"]}'
                assert abs(timestamp(r['game_date_time'])-g['at'])<1
                assert num(r,'team_score')==g['h' if side=='home' else 'a']
                keys=['points','field_goals_made','field_goals_attempted','free_throws_made','free_throws_attempted','offensive_rebounds','defensive_rebounds','assists','steals','blocks','fouls','turnovers','three_point_field_goals_made','three_point_field_goals_attempted']
                v=[num(r,k) for k in keys];assert all(x>=0 for x in v)
                pts,fg,fa,ft,fta,orb,drb,ast,stl,blk,pf,tov,three,threea=v
                assert 2*fg+three+ft==pts and fg<=fa and ft<=fta and three<=fg and threea<=fa
                gs=pts+.4*fg-.7*fa-.4*(fta-ft)+.7*orb+.3*drb+stl+.7*ast+.7*blk-.4*pf-tov
                row={'id':r['athlete_id'],'name':r['athlete_display_name'],'team':r['team_id'],'m':m,'gs':gs,'pts':pts,'reb':orb+drb,'ast':ast,'stl':stl,'blk':blk,'tov':tov,'fg':fg,'fa':fa,'ft':ft,'fta':fta,'orb':orb,'three':three,'threea':threea}
                key=(r['team_id'],r['athlete_id']);old=boxes[g['id']].get(key)
                if old and old!=row:raise ValueError('conflicting player box')
                boxes[g['id']][key]=row;names[r['athlete_id']]=r['athlete_display_name']
            except (ValueError,KeyError,AssertionError): continue
    games=[]
    for g in fixtures.values():
        rows=list(boxes[g['id']].values())
        if all(sum(r['pts'] for r in rows if r['team']==g[s])==g['h' if s=='home' else 'a'] and abs(sum(r['m'] for r in rows if r['team']==g[s])-5*(REGULATION+5*(g['period']-4)))<=8 for s in ['home','away']):
            games.append({**g,'players':rows})
    # Never refresh timestamps on an archive missing a team's latest finished box.
    cutoff=datetime.now(timezone.utc).timestamp()-6*3600
    for team in {g[s] for g in fixtures.values() for s in ['home','away']}:
        expected=max((g for g in fixtures.values() if g['at']<cutoff and team in [g['home'],g['away']]),key=lambda g:g['at'],default=None)
        actual=max((g for g in games if g['at']<cutoff and team in [g['home'],g['away']]),key=lambda g:g['at'],default=None)
        if expected and (not actual or expected['id']!=actual['id']):raise ValueError('Latest completed player box missing for team '+team)
    return sorted(games,key=lambda g:(g['at'],g['id'])),names

def player_stats(rows,now):
    rows=[r for r in rows if now-400*DAY<=r['at']<now][-40:]
    if not rows:return None
    weights=[math.exp(-(now-r['at'])/(180*DAY)) for r in rows]
    minutes=sum(r['m']*w for r,w in zip(rows,weights));total=sum(weights)
    # Reliability shrinkage expressed in observed minutes, not star reputation.
    rate=(sum(r['gs']*w for r,w in zip(rows,weights))+200*.30)/(minutes+200)
    recent=rows[-10:]
    return {'games':len(rows),'rate':rate,'minutes':sum(r['m'] for r in recent)/len(recent),'lastPlayed':rows[-1]['at'],'sampleMinutes':sum(r['m'] for r in rows),'points':sum(r['pts'] for r in rows)/len(rows),'rebounds':sum(r['reb'] for r in rows)/len(rows),'assists':sum(r['ast'] for r in rows)/len(rows),'steals':sum(r['stl'] for r in rows)/len(rows),'blocks':sum(r['blk'] for r in rows)/len(rows),'turnovers':sum(r['tov'] for r in rows)/len(rows)}

def recent_games(hist,team,now):return [g for g in hist[team] if now-400*DAY<=g['at']<now][-20:]
def team_net(hist,team,now):
    rows=recent_games(hist,team,now)
    return sum((g['h']-g['a'])*(1 if g['home']==team else -1) for g in rows)/len(rows) if rows else 0
def team_features(hist,players,team,now):
    rows=recent_games(hist,team,now)
    if len(rows)<8:return None
    net=team_net(hist,team,now)
    sos=sum(team_net(hist,g['away'] if g['home']==team else g['home'],now) for g in rows)/len(rows)
    # Prior rotation only. A traded newcomer first enters historical predictions
    # after appearing, whereas live NBA.com rosters can identify him immediately.
    minutes=defaultdict(float)
    for g in rows[-10:]:
        for p in g['players']:
            if p['team']==team:minutes[p['id']]+=p['m']
    rates={p:player_stats(players[p],now) for p in minutes}
    if any(r is None for r in rates.values()):return None
    strength=sum(minutes[p]*rates[p]['rate'] for p in minutes)/sum(minutes.values())*(5*REGULATION)
    return {'net':net,'sos':sos,'strength':strength,'rest':min(7,(now-rows[-1]['at'])/DAY),'games':len(rows)}

def chronological(games):
    hist=defaultdict(list);players=defaultdict(list);samples=[]
    for _,group in itertools.groupby(games,key=lambda g:int(g['at']//DAY)):
        today=list(group)
        # Freeze a whole UTC day's inputs before adding any results. Earlier
        # tip-offs can still be in progress when another game starts.
        for g in today:
            now=g['at'];h=team_features(hist,players,g['home'],now);a=team_features(hist,players,g['away'],now)
            if h and a:
                samples.append({'year':g['year'],'at':now,'id':g['id'],'x':[0 if g['neutral'] else 1,h['strength']-a['strength'],h['net']-a['net'],h['sos']-a['sos'],h['rest']-a['rest']],'y':g['h']-g['a']})
        for g in today:
            for team in [g['home'],g['away']]:hist[team].append(g)
            for r in g['players']:players[r['id']].append({**r,'at':g['at']})
    return samples,hist,players

def fit(samples,alpha=30):
    import numpy as np
    x=np.array([r['x'] for r in samples]);y=np.array([r['y'] for r in samples]);scales=np.sqrt((x*x).mean(axis=0));scales[scales==0]=1
    z=x/scales;co=np.linalg.solve(z.T@z+np.eye(5)*alpha,z.T@y)/scales
    return co.tolist()
def metrics(rows,co,sigma):
    p=[max(.001,min(.999,.5*(1+math.erf(sum(a*b for a,b in zip(r['x'],co))/sigma/math.sqrt(2))))) for r in rows];y=[int(r['y']>0) for r in rows]
    return {'games':len(rows),'brier':sum((v-t)**2 for v,t in zip(p,y))/len(y),'logLoss':-sum(math.log(v if t else 1-v) for v,t in zip(p,y))/len(y),'accuracy':sum((v>.5)==bool(t) for v,t in zip(p,y))/len(y)}

def snapshot(hist,players,names,index,now):
    by_name=defaultdict(list)
    for p in index:by_name[name_key(p['PLAYER_FIRST_NAME']+' '+p['PLAYER_LAST_NAME'])].append(str(p['PERSON_ID']))
    source_names=defaultdict(list)
    for id,n in names.items():source_names[name_key(n)].append(id)
    ps={};excluded=[]
    for id,rows in players.items():
        key=name_key(names[id]);matches=by_name[key]
        if len(matches)!=1 or len(source_names[key])!=1:excluded.append(names[id]);continue
        s=player_stats(rows,now)
        if s:ps[matches[0]]={**s,'name':names[id],'sourceId':id}
    teams={}
    for id in hist:
        f=team_features(hist,players,id,now)
        rows=recent_games(hist,id,now)
        if f:teams[id]={**f,'lastPlayed':rows[-1]['at'],'pointsFor':sum(g['h'] if g['home']==id else g['a'] for g in rows)/len(rows),'pointsAgainst':sum(g['a'] if g['home']==id else g['h'] for g in rows)/len(rows)}
    return {'schema':1,'capturedAt':datetime.fromtimestamp(now,timezone.utc).isoformat(),'source':f'{LEAGUE}.com player identities; SportsDataverse ESPN {LEAGUE} verified individual boxes','players':ps,'teams':teams,'unmatchedNames':excluded,'identityMethod':'unique exact normalized full name on both sources'}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--train',action='store_true');ap.add_argument('--refresh',action='store_true');args=ap.parse_args();folder=ROOT/'evidence';folder.mkdir(exist_ok=True)
    now=datetime.now(timezone.utc).timestamp()
    if args.refresh:
        end=datetime.now(timezone.utc).year+(datetime.now(timezone.utc).month>=9);years=[end-1,end];available=[]
        for year in years:
            for kind in ['players','schedule']:
                url=f'https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_nba_{"player_boxscores" if kind=="players" else "schedules"}/{"player_box" if kind=="players" else "nba_schedule"}_{year}.csv'
                try:data=urllib.request.urlopen(url,timeout=40).read(30000001)
                except urllib.error.HTTPError as e:
                    if year==end and e.code==404:break
                    raise
                if len(data)>30000000:raise ValueError('source too large')
                name=('player-csv.csv' if kind=='players' else 'schedule.csv') if year==2026 else f'{kind}-{year}.csv';(folder/name).write_bytes(data)
            else:available.append(year)
        raw=urllib.request.urlopen('https://www.nba.com/players',timeout=30).read(6000000).decode();index=json.loads(re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>',raw)[1])['props']['pageProps']['players'];years=available
    else:
        years=[2023,2024,2025,2026];index=json.loads((folder/'players.json').read_text())['props']['pageProps']['players']
    games,names=read_games(folder,years);games=[g for g in games if g['at']+6*3600<now];assert len(games)>=1000
    samples,hist,players=chronological(games)
    if args.train:
        train=[r for r in samples if r['year']==2024];tune=[r for r in samples if r['year']==2025];test=[r for r in samples if r['year']==2026]
        selected=[]
        for alpha in [10,30,100,300]:
            co=fit(train,alpha);sigma=math.sqrt(sum((r['y']-sum(a*b for a,b in zip(r['x'],co)))**2 for r in tune)/len(tune));selected.append((metrics(tune,co,sigma)['logLoss'],alpha,sigma))
        _,alpha,sigma=min(selected);co=fit(train+tune,alpha)
        result=metrics(test,co,sigma);baseline=metrics(test,[2.5,0,.5,0,0],10.5)
        enabled=result['brier']<baseline['brier'] and result['logLoss']<baseline['logLoss']
        model={'version':'nba-player-opponent-v3-20261003','features':['homeVenue','playerProductionDiff','recentNetDiff','opponentNetDiff','restDiff'],'coefficients':co,'sigma':sigma,'enabled':enabled,'regularSeasonValidated':enabled,'validationScope':'historical previous-rotation minutes; excludes live news and preseason scenarios','preseasonValidated':False,'alpha':alpha,'trainedSeasons':[2024,2025],'holdoutSeason':2026,'validation':result,'referenceRecentNet':baseline,'createdAt':datetime.fromtimestamp(now,timezone.utc).isoformat()}
        (ROOT/'data/nba-player-model.json').write_text(json.dumps(model,indent=2)+'\n');print(json.dumps(model))
    s=snapshot(hist,players,names,index,now);assert len(s['players'])>300 and len(s['teams'])==30
    target=ROOT/'data/nba-player-strength.json';temp=target.with_suffix('.tmp');temp.write_text(json.dumps(s,separators=(',',':'))+'\n');temp.replace(target)
    print(json.dumps({'games':len(games),'players':len(s['players']),'teams':len(s['teams']),'unmatchedCount':len(s['unmatchedNames'])}))
if __name__=='__main__':main()
