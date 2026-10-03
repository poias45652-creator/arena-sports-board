"""Refresh verified ESPN ↔ FotMob portrait identities. Public data only.
Run: python scripts/football-photos/collect.py --cache /tmp/football-photos --season 2026
Photo inspection requires Pillow; source caches stay outside the repository.
"""
import argparse,concurrent.futures,collections,datetime,hashlib,io,json,re,time,unicodedata,urllib.request,urllib.parse
from pathlib import Path
from difflib import SequenceMatcher
from PIL import Image
P=argparse.ArgumentParser();P.add_argument('--cache',required=True);P.add_argument('--season',type=int,required=True);P.add_argument('--phase',choices=['collect','match','enrich','verify','export'],required=True);a=P.parse_args();cache=Path(a.cache);cache.mkdir(parents=True,exist_ok=True)
leagues={'eng.1':47,'esp.1':87,'ger.1':54,'ita.1':55,'fra.1':53,'uefa.champions':42,'uefa.nations':None}
ROOT='https://site.api.espn.com/apis/site/v2/sports/soccer';FM='https://www.fotmob.com/api/data/'
def save(path,data):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
def fetch(url,key):
 p=cache/(key+'.json')
 if p.exists():return json.loads(p.read_text())
 last=None
 for attempt in range(2):
  try:
   with urllib.request.urlopen(url,timeout=25) as r:data=json.load(r)
   save(p,data);return data
  except Exception as e:last=e
 raise last

def norm(s):
 s=s.lower().translate(str.maketrans({'ø':'o','ł':'l','đ':'d','ð':'d','ı':'i','þ':'th','æ':'ae','ß':'ss'}))
 return re.sub(r'[^a-z0-9]+',' ',''.join(c for c in unicodedata.normalize('NFKD',s) if not unicodedata.combining(c))).strip()
def match_names(names,p):
 n=norm(p['name']);targets={norm(x) for x in names if x}
 if n in targets:return 'name+birth'
 tokens=set(n.split())
 for t in targets:
  parts=t.split()
  if len(parts)>1 and any(len(x)>=4 and x in tokens for x in parts) and (SequenceMatcher(None,t,n).ratio()>=.60 or parts[0][0]==n[0]):return 'surname+birth'
 return None

def parallel(fn,items,workers=6):
 with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:return list(pool.map(fn,items))

def collect():
 teams={};provider={}
 for league,fid in leagues.items():
  data=fetch(f'{ROOT}/{league}/teams?limit=200','espn-teams-'+league)
  for row in data['sports'][0]['leagues'][0]['teams']:
   t=row['team'];teams.setdefault(t['id'],{'id':t['id'],'name':t['displayName'],'names':[t.get(k,'') for k in ['displayName','name','shortDisplayName']],'league':league})
  if fid:
   data=fetch(FM+'leagues?id='+str(fid),'fotmob-league-'+league)
   def walk(v):
    if isinstance(v,dict):
     if str(v.get('pageUrl','')).startswith('/teams/') and v.get('id') and v.get('name'):provider[str(v['id'])]={'id':v['id'],'name':v['name']}
     for x in v.values():walk(x)
    elif isinstance(v,list):
     for x in v:walk(x)
   walk(data['table'])
 # The public FIFA ranking in a national team page supplies verified national team IDs.
 ranks=fetch(FM+'teams?id=6718','fm-team-6718')['details']['fifaRanking']['rankings']['ranks']
 aliases={'czech republic':'czechia','turkey':'turkiye','republic of ireland':'ireland','faroe islands':'faroe islands'}
 unknown=[]
 for t in teams.values():
  if t['league']!='uefa.nations':continue
  names={aliases.get(norm(n),norm(n)) for n in t['names']};matches=[r for r in ranks if norm(r['name']) in names]
  if len(matches)==1:r=matches[0];provider[str(r['id'])]={'id':r['id'],'name':r['name']}
  else:unknown.append(t)
 def search_team(t):
  try:
   data=fetch(FM+'search/suggest?term='+urllib.parse.quote(t['name']),'search-team-'+t['id'])
   rows={str(r['id']):r for g in data for r in g.get('suggestions',[]) if r.get('type')=='team' and norm(r['name']) in {norm(n) for n in t['names']}}
   if len(rows)==1:return next(iter(rows.values()))
  except Exception as e:print('team-search-error',t['name'],str(e),flush=True)
  return None
 # Include clubs whose provider league table uses a different spelling or season roster.
 known={norm(x['name']) for x in provider.values()}
 for t in teams.values():
  if t['league']!='uefa.nations' and not any(norm(n) in known for n in t['names']):unknown.append(t)
 for r in parallel(search_team,unknown):
  if r:provider[str(r['id'])]={'id':r['id'],'name':r['name']}
 save(cache/'teams.json',list(teams.values()));save(cache/'provider-teams.json',list(provider.values()))
 print('teams',len(teams),'provider teams',len(provider),flush=True)
 def espn(t):
  try:
   d=fetch(f"{ROOT}/{t['league']}/teams/{t['id']}/roster?season={a.season}",f"espn-roster-{t['id']}")
   assert str(d['team']['id'])==t['id'] and d['season']['year']==a.season
   return {'team':t,'players':d['athletes']}
  except Exception as e:return {'team':t,'error':str(e),'players':[]}
 espn_rows=parallel(espn,teams.values());save(cache/'espn-rosters.json',espn_rows)
 def fotmob(t):
  try:
   d=fetch(FM+'teams?id='+str(t['id']),'fm-team-'+str(t['id']));assert str(d['details']['id'])==str(t['id']) and d['details'].get('gender')=='male'
   return [dict(p,sourceTeamId=t['id']) for g in d['squad']['squad'] if g['title']!='coach' for p in g['members']]
  except Exception as e:print('provider-error',t['name'],str(e),flush=True);return []
 players={str(p['id']):p for group in parallel(fotmob,provider.values()) for p in group};save(cache/'provider-players.json',players)
 print('ESPN rosters',len(espn_rows),'failures',sum('error'in r for r in espn_rows),'provider players',len(players),flush=True)

def match():
 rosters=json.loads((cache/'espn-rosters.json').read_text());pool=json.loads((cache/'provider-players.json').read_text());players={}
 for r in rosters:
  for p in r['players']:
   player=players.setdefault(str(p['id']),dict(p,teams=[]));player['teams'].append(r['team']['id'])
 bybirth=collections.defaultdict(list)
 for p in pool.values():bybirth[str(p.get('dateOfBirth',''))[:10]].append(p)
 matched={};missing=[];conflicts=[]
 def choose(p,candidates):
  dob=str(p.get('dateOfBirth',''))[:10]
  if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',dob):return None
  rows=[(x,match_names([p.get('displayName'),p.get('fullName')],x)) for x in candidates if str(x.get('dateOfBirth',''))[:10]==dob]
  rows=[(x,k) for x,k in rows if k];exact=[r for r in rows if r[1]=='name+birth'];rows=exact or rows
  ids={str(x['id']):(x,k) for x,k in rows}
  if len(ids)==1:
   x,k=next(iter(ids.values()));return {'name':p['displayName'],'birthDate':dob,'providerId':str(x['id']),'providerName':x['name'],'identity':k,'teams':p['teams'],'url':f"https://images.fotmob.com/image_resources/playerimages/{x['id']}.png"}
  return None
 for eid,p in players.items():
  m=choose(p,bybirth[str(p.get('dateOfBirth',''))[:10]])
  if m:matched[eid]=m
  else:missing.append(p)
 print('initial matched',len(matched),'unmatched',len(missing),flush=True)
 def lookup(p):
  eid=str(p['id']);candidates={}
  try:
   for term in dict.fromkeys([p['displayName'],p.get('fullName',p['displayName'])]):
    data=fetch(FM+'search/suggest?term='+urllib.parse.quote(term),'search-player-'+eid+'-'+hashlib.sha1(term.encode()).hexdigest()[:8])
    for group in data:
     for x in group.get('suggestions',[]):
      if x.get('type')=='player' and not x.get('isCoach') and (norm(x['name'])==norm(term) or SequenceMatcher(None,norm(x['name']),norm(term)).ratio()>.58):candidates[str(x['id'])]=x
   verified=[]
   for fid,x in list(candidates.items())[:5]:
    if fid in pool:verified.append(pool[fid]);continue
    d=fetch(FM+'playerData?id='+fid,'fm-player-'+fid)
    if str(d.get('id'))!=fid or d.get('isCoach') or d.get('gender') not in ['male',None]:continue
    verified.append({'id':fid,'name':d['name'],'dateOfBirth':d.get('birthDate',{}).get('utcTime','')[:10]})
   return eid,choose(p,verified)
  except Exception as e:return eid,None
 for i,(eid,m) in enumerate(parallel(lookup,missing),1):
  if m:matched[eid]=m
 save(cache/'matched.json',matched);save(cache/'unmatched.json',[{'id':eid,'name':p['displayName'],'birthDate':str(p.get('dateOfBirth',''))[:10],'teams':p['teams']} for eid,p in players.items() if eid not in matched]);save(cache/'espn-players.json',players)
 print('matched',len(matched),'unmatched',len(players)-len(matched),flush=True)

def verify():
 matched=json.loads((cache/'matched.json').read_text());matched.update(json.loads((Path(__file__).resolve().parents[2]/'data/football-player-photo-overrides.json').read_text()));save(cache/'matched.json',matched);ids={p['providerId']:p for p in matched.values()};photos=cache/'photos';photos.mkdir(exist_ok=True)
 previous=json.loads((cache/'photo-audit.json').read_text()) if (cache/'photo-audit.json').exists() else {}
 def check(item):
  fid,p=item;path=photos/(fid+'.png')
  if fid in previous and not previous[fid]['ok']:return fid,previous[fid]
  try:
   if not path.exists():
    with urllib.request.urlopen(p['url'],timeout=25) as r:
     assert 'image/' in r.headers.get('content-type','');data=r.read(1500000);assert len(data)<1500000;path.write_bytes(data)
   data=path.read_bytes();im=Image.open(io.BytesIO(data));im.load();assert im.width>=80 and im.height>=80
   alpha=im.convert('RGBA').getchannel('A');lo,hi=alpha.getextrema();assert hi>0 and lo<255
   return fid,{'ok':True,'sha256':hashlib.sha256(data).hexdigest(),'width':im.width,'height':im.height,'transparent':lo<255,'bytes':len(data)}
  except Exception as e:return fid,{'ok':False,'error':str(e)}
 audit=dict(parallel(check,ids.items(),16));digests=collections.Counter(r.get('sha256') for r in audit.values() if r['ok'])
 for r in audit.values():
  if r['ok'] and digests[r['sha256']]>2:r.update(ok=False,error='Repeated placeholder image')
 save(cache/'photo-audit.json',audit)
 verified={eid:p for eid,p in matched.items() if audit[p['providerId']]['ok']};save(cache/'verified.json',verified)
 print('verified',len(verified),'bad',len(matched)-len(verified),'opaque',sum(not audit[p['providerId']]['transparent']for p in verified.values()),flush=True)

def enrich():
 matched=json.loads((cache/'matched.json').read_text());missing=json.loads((cache/'unmatched.json').read_text());espn=json.loads((cache/'espn-players.json').read_text());rosters=json.loads((cache/'espn-rosters.json').read_text());pool=json.loads((cache/'provider-players.json').read_text())
 memberships={};team_members={}
 for file in cache.glob('fm-team-*.json'):
  d=json.loads(file.read_text());fid=str(d['details']['id']);members={str(p['id']) for g in (d.get('squad') or {}).get('squad',[]) or [] if g['title']!='coach' for p in g['members']}
  team_members[fid]=members
  for pid in members:memberships.setdefault(pid,set()).add(fid)
 team_map={}
 for r in rosters:
  ids={matched[str(p['id'])]['providerId']for p in r['players'] if str(p['id'])in matched and matched[str(p['id'])]['identity']=='name+birth'}
  ranks=sorted([(len(ids&m),tid)for tid,m in team_members.items()],reverse=True)
  if ranks and ranks[0][0]>=3 and (len(ranks)==1 or ranks[0][0]>ranks[1][0]):team_map[r['team']['id']]=ranks[0][1]
 save(cache/'team-mapping.json',team_map)
 def choose(p,candidates):
  rows={};names=[norm(p['displayName']),norm(p.get('fullName',''))];dob=str(p.get('dateOfBirth',''))[:10];teams={team_map[t]for t in p['teams']if t in team_map}
  for x in candidates:
   fid=str(x['id']);n=norm(x['name']);same_team=bool(memberships.get(fid,set())&teams);birth=str(x.get('dateOfBirth',''))[:10]
   if dob and birth==dob and (match_names([p['displayName'],p.get('fullName','')],x) or any(SequenceMatcher(None,t,n).ratio()>=.82 or sorted(t.split())==sorted(n.split()) for t in names if t) or any(any(len(token)>=3 and token in n.split() and token not in {'junior','jose','joao','juan','mohamed','mamadou','david','daniel','pedro'} for token in t.split()) for t in names if t)):rows[fid]=(x,'name-variant+birth')
   elif same_team and any(t and (n==t or t[0]==n[0] and len(set(t.split())&set(n.split()))>=2) for t in names):rows[fid]=(x,'name+verified-team')
  if len(rows)!=1:return None
  x,proof=next(iter(rows.values()));return {'name':p['displayName'],'birthDate':dob or x.get('dateOfBirth',''),'providerId':str(x['id']),'providerName':x['name'],'identity':proof,'teams':p['teams'],'url':f"https://images.fotmob.com/image_resources/playerimages/{x['id']}.png"}
 def lookup(short):
  eid=short['id'];p=espn[eid];m=choose(p,pool.values())
  if m:return eid,m
  candidates={};terms=list(dict.fromkeys([p.get('lastName',''),p['displayName'].split()[-1],p.get('firstName','')+' '+p['displayName'].split()[-1]]))
  try:
   for term in terms[:2]:
    if len(term)<4:continue
    data=fetch(FM+'search/suggest?term='+urllib.parse.quote(term),'search-player-'+eid+'-'+hashlib.sha1(term.encode()).hexdigest()[:8])
    for group in data:
     for x in group.get('suggestions',[]):
      if x.get('type')=='player' and not x.get('isCoach') and (norm(x['name'])==norm(p['displayName']) or SequenceMatcher(None,norm(x['name']),norm(p['displayName'])).ratio()>.48):candidates[str(x['id'])]=x
   verified=[]
   for fid,x in list(candidates.items())[:8]:
    if fid in pool:verified.append(pool[fid]);continue
    d=fetch(FM+'playerData?id='+fid,'fm-player-'+fid)
    if str(d.get('id'))!=fid or d.get('isCoach') or d.get('gender') not in ['male',None]:continue
    team_id=str((d.get('primaryTeam')or{}).get('teamId',''));memberships.setdefault(fid,set()).add(team_id)
    academy=norm((d.get('primaryTeam')or{}).get('teamName',''));academy=re.sub(r' (u\d{2}|ii|b|youth|primavera)$','',academy)
    for tid in p['teams']:
     if tid in team_map:
      td=fetch(FM+'teams?id='+team_map[tid],'fm-team-'+team_map[tid]);parent=norm(td['details']['name'])
      if academy==parent:memberships[fid].add(team_map[tid])
    verified.append({'id':fid,'name':d['name'],'dateOfBirth':d.get('birthDate',{}).get('utcTime','')[:10]})
   return eid,choose(p,verified)
  except Exception as e:return eid,None
 for eid,m in parallel(lookup,missing):
  if m:matched[eid]=m
 save(cache/'matched.json',matched);save(cache/'unmatched.json',[p for p in missing if p['id']not in matched]);print('enriched matched',len(matched),'remaining',len(espn)-len(matched),flush=True)

def export():
 root=Path(__file__).resolve().parents[2]
 players=json.loads((cache/'espn-players.json').read_text());verified=json.loads((cache/'verified.json').read_text());matched=json.loads((cache/'matched.json').read_text());rosters=json.loads((cache/'espn-rosters.json').read_text())
 catalog={}
 for eid,p in players.items():
  catalog[eid]={'name':p['displayName'],'birthDate':str(p.get('dateOfBirth',''))[:10]}
  if eid in verified:catalog[eid]['providerId']=verified[eid]['providerId']
 stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
 save(root/'data/football-player-photos.json',{'version':1,'season':a.season,'verifiedAt':stamp,'players':catalog})
 coverage=[dict(id=r['team']['id'],name=r['team']['name'],total=len(r['players']),withPhoto=sum(str(p['id'])in verified for p in r['players']))for r in rosters]
 missing=[dict(id=eid,name=p['displayName'],teams=p['teams'],reason='Source photo unavailable'if eid in matched else'No unambiguous identity match')for eid,p in players.items()if eid not in verified]
 save(root/'docs/football-player-photo-audit.json',{'verifiedAt':stamp,'season':a.season,'uniquePlayers':len(players),'verifiedTransparentPhotos':len(verified),'teams':coverage,'missing':missing})
 print('exported',len(verified),'photos;',len(missing),'missing;',len(coverage),'teams',flush=True)

if a.phase=='collect':collect()
elif a.phase=='match':match()
elif a.phase=='enrich':enrich()
elif a.phase=='verify':verify()
else:export()
