"""Import official Retrosheet Game Logs. Run from the site root; no login required."""
import csv,io,json,zipfile,urllib.request,hashlib,datetime,concurrent.futures
from pathlib import Path
YEARS=[2023,2024,2025]
TEAMS={'ANA':108,'ARI':109,'BAL':110,'BOS':111,'CHN':112,'CIN':113,'CLE':114,'COL':115,'DET':116,'HOU':117,'KCA':118,'LAN':119,'WAS':120,'NYN':121,'OAK':133,'ATH':133,'PIT':134,'SDN':135,'SEA':136,'SFN':137,'SLN':138,'TBA':139,'TEX':140,'TOR':141,'MIN':142,'PHI':143,'ATL':144,'CHA':145,'MIA':146,'NYA':147,'MIL':158}
NOTICE='The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at "www.retrosheet.org".'
def day(s):return datetime.datetime.strptime(s,'%Y%m%d').date().isoformat()
def load(year):
 url=f'https://www.retrosheet.org/gamelogs/gl{year}.zip'
 raw=urllib.request.urlopen(url,timeout=45).read();z=zipfile.ZipFile(io.BytesIO(raw));files=[n for n in z.namelist() if n.lower()==f'gl{year}.txt'];assert len(files)==1
 games=[]
 for c in csv.reader(io.StringIO(z.read(files[0]).decode('utf-8-sig'))):
  if not c:continue
  assert len(c)==161,(year,len(c));date=day(c[0]);assert int(date[:4])==year
  away,home=TEAMS[c[3]],TEAMS[c[6]];a,h=int(c[9]),int(c[10]);assert min(a,h)>=0 and away!=home
  complete=day(c[13].split(',')[0]) if c[13] else date
  def lineup(start):return [{'retroId':c[start+i*3],'name':c[start+i*3+1],'position':c[start+i*3+2]} for i in range(9)]
  flags=[]
  if c[13]:flags.append('suspended_or_later_completion')
  if c[14]:flags.append('forfeit')
  if c[15]:flags.append('protest')
  if a==h:flags.append('tie')
  if not c[11] or int(c[11])<51:flags.append('shortened_or_unknown_length')
  games.append({'id':f'{c[6]}{c[0]}{c[1]}','season':year,'date':date,'completionDate':complete,'doubleheader':c[1],'awayId':away,'homeId':home,'parkId':c[16] or None,'awayStarter':{'retroId':c[101],'name':c[102]},'homeStarter':{'retroId':c[103],'name':c[104]},'awayLineup':lineup(105),'homeLineup':lineup(132),'result':{'away':a,'home':h,'outs':int(c[11]) if c[11] else None},'flags':flags,'trainingEligible':not flags,'acquisition':c[160]})
 assert len({g['id'] for g in games})==len(games)
 return games,{'season':year,'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'games':len(games)}
def prepare():
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:parts=list(pool.map(load,YEARS))
 games=sorted([g for rows,_ in parts for g in rows],key=lambda g:(g['date'],g['id']))
 # Only completed prior calendar days enter features. Same-day games are all excluded.
 for year in YEARS:
  season=[g for g in games if g['season']==year];completed=sorted([g for g in season if g['trainingEligible']],key=lambda g:g['completionDate']);state={};cursor=0
  def blank():return {'games':0,'wins':0,'losses':0,'runsFor':0,'runsAgainst':0}
  for g in season:
   while cursor<len(completed) and completed[cursor]['completionDate']<g['date']:
    prev=completed[cursor];cursor+=1
    for side,other in [('away','home'),('home','away')]:
     r=state.setdefault(prev[side+'Id'],blank());a=prev['result'][side];h=prev['result'][other];r['games']+=1;r['wins']+=int(a>h);r['losses']+=int(a<h);r['runsFor']+=a;r['runsAgainst']+=h
   g['pregame']={'away':dict(state.get(g['awayId'],blank())),'home':dict(state.get(g['homeId'],blank())),'cutoffExclusive':g['date']}
 result={'source':'https://www.retrosheet.org/gamelogs/index.html','attribution':NOTICE,'preparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'seasons':YEARS,'archives':[meta for _,meta in parts],'games':games,'scope':'regular season game logs; no play-by-play or historical odds','lineupAvailability':'actual starting lineups; announcement time unknown','modelApplied':False}
 Path('data/retrosheet.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
 print(json.dumps({'games':len(games),'eligible':sum(g['trainingEligible'] for g in games),'archives':result['archives'],'bytes':Path('data/retrosheet.json').stat().st_size}),flush=True)
if __name__=='__main__':prepare()
