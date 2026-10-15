"""Collect public identity/portrait evidence for manual review. Never publish.

No authentication, retry on denial, or inferred name-only identity is used in
the production catalog. Candidate matches below require human verification.
"""
import concurrent.futures
import hashlib
import io
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from PIL import Image

root = Path(__file__).resolve().parents[2]
cache = Path(sys.argv[1])
cache.mkdir(parents=True, exist_ok=True)
gaps = json.loads((root / 'docs/football-europa-photo-gaps.json').read_text())
def save(name, value):
    (cache / name).write_text(json.dumps(value, ensure_ascii=False, indent=2))
def fetch(url):
    with urllib.request.urlopen(url, timeout=25) as response:
        data = response.read(4_000_001)
        assert len(data) <= 4_000_000
        return data
def norm(name):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', name.lower()).encode('ascii','ignore').decode())

club_names = {'Ararat-Armenia':'20024','GNK Dinamo':'597','H. Beer-Sheva':'13083',
    'Jagiellonia':'11505','Lech Poznań':'2990','Levski Sofia':'490','Lillestrøm':'987',
    'Celje':'3362','OFI Crete':'1010','Olympiacos':'435','Omonia':'617',
    'Salzburg':'2790','Sparta Praha':'433','Torreense':'21615'}
club_page = 'https://www.uefa.com/uefaeuropaleague/clubs/'
html = fetch(club_page)
(cache/'clubs.html').write_bytes(html)
soup = BeautifulSoup(html, 'html.parser')
clubs = {}
for a in soup.select('a[href]'):
    label = a.get_text(' ', strip=True)
    for name, espn in club_names.items():
        if name in label and re.search(r'/clubs/\d+', a['href']):
            clubs[espn] = dict(name=name, url=urljoin(club_page,a['href']).rstrip('/')+'/squad/')
save('clubs.json',clubs)

def squad(item):
    team, info = item
    try:
        html = fetch(info['url'])
        (cache/f'squad-{team}.html').write_bytes(html)
        soup = BeautifulSoup(html,'html.parser')
        rows = {}
        for a in soup.select('a[href]'):
            match = re.search(r'/players/(\d+)--([^/]+)/', a['href'])
            if match:
                uid, slug = match.groups()
                rows[uid] = dict(uid=uid, slug=slug, name=a.get_text(' ',strip=True),
                    page=urljoin(info['url'],a['href']), team=team,
                    context=a.parent.get_text(' ',strip=True)[:1200], html=str(a.parent)[:12000])
        return team, dict(info,players=list(rows.values()))
    except Exception as exc:
        return team, dict(info,error=str(exc))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    squads = dict(pool.map(squad,clubs.items()))
save('squads.json',squads)

candidates=[]
for gap in gaps:
    names = [gap['name'], *gap.get('aliases',[])]
    for team in gap['teams']:
        for player in squads.get(team,{}).get('players',[]):
            tokens=set(norm(t) for t in player['slug'].split('-'))
            if any(norm(n) == norm(player['slug']) or norm(n.split()[-1]) in tokens for n in names):
                candidates.append(dict(gap, **{k:player[k] for k in ['uid','slug','page','context']},
                    url=f"https://img.uefa.com/imgml/TP/players/1/2027/cutoff/{player['uid']}.webp"))
def portrait(row):
    try:
        html=fetch(row['page'])
        (cache/f"player-{row['uid']}.html").write_bytes(html)
        text=BeautifulSoup(html,'html.parser').get_text(' ',strip=True)
        row['profileText']=text[:20000]
        data=fetch(row['url'])
        image=Image.open(io.BytesIO(data)); image.load()
        assert image.format in {'WEBP','PNG','JPEG'}
        assert 80 <= image.width <= 2048 and 80 <= image.height <= 2048
        filename=f"{row['id']}-{row['uid']}.webp"
        (cache/filename).write_bytes(data)
        return dict(row,ok=True,file=filename,sha256=hashlib.sha256(data).hexdigest(),
            type=Image.MIME[image.format],width=image.width,height=image.height,bytes=len(data),
            transparent=image.convert('RGBA').getchannel('A').getextrema()[0] < 255)
    except Exception as exc:
        return dict(row,ok=False,error=str(exc))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results=list(pool.map(portrait,candidates))
save('candidates.json',results)
print(json.dumps({'teams':len(clubs),'squadPlayers':sum(len(s.get('players',[])) for s in squads.values()),
    'candidates':len(results),'validImages':sum(p['ok'] for p in results)}),flush=True)
