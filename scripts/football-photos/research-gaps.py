"""Download explicitly selected public portrait evidence for manual review.

No authentication or retries. Rejected resources are recorded, never bypassed.
The production catalog is updated separately after identity and image review.
"""
import concurrent.futures
import hashlib
import io
import json
import re
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from PIL import Image

root = Path(__file__).resolve().parents[2]
cache = Path(sys.argv[1]); cache.mkdir(parents=True,exist_ok=True)
rows = json.loads((root/'docs/football-europa-photo-gaps.json').read_text())
def fetch(url):
    with urllib.request.urlopen(url,timeout=25) as response:
        data=response.read(4_000_001)
        assert len(data)<=4_000_000
        return data

def inspect(row):
    folder=cache/row['id'];folder.mkdir(exist_ok=True)
    sources=[dict(url=url,context="Explicit public source candidate") for url in row.get("urls",[])];pages=[]
    if row.get('uefaId'):
        sources.append(dict(url=f"https://img.uefa.com/imgml/TP/players/1/2027/cutoff/{row['uefaId']}.webp",context='UEFA player ID; inspect identity evidence before publishing'))
    for url in row.get('pages',[]):
        try:
            data=fetch(url)
            filename=f'page-{len(pages)}.html';(folder/filename).write_bytes(data)
            soup=BeautifulSoup(data,'html.parser')
            base_tag=soup.select_one('base[href]'); base_url=urljoin(url,base_tag['href']) if base_tag else url
            pages.append(dict(url=url,file=filename,text=soup.get_text(' ',strip=True)[:50000]))
            for img in soup.select('img,source,meta[property="og:image"],meta[name="twitter:image"]'):
                for attr in ['src','data-src','content','srcset','data-srcset']:
                    value=img.get(attr)
                    if not value:continue
                    for src in (value.split(',') if 'srcset' in attr else [value]):
                        src=src.strip().split(' ')[0]
                        full=urljoin(base_url,src)
                        if not full.startswith('https://') or re.search(r'logo|sponsor|icon|flag|badge|partner',full,re.I):continue
                        sources.append(dict(url=full,context=str(img)[:1500],page=url))
            for match in re.finditer(r'https?[^\s"<>]+\.(?:png|webp|jpe?g)(?:\?[^\s"<>]*)?',data.decode('utf-8','replace').replace('\\/','/')):
                full=match.group(0)
                if re.search(r'portrait|player|spieler|person|squad',full,re.I) and not re.search(r'logo|icon|flag|badge',full,re.I):
                    sources.append(dict(url=full,context='Embedded image URL',page=url))
        except Exception as exc:pages.append(dict(url=url,error=str(exc)))
    photos=[];seen=set()
    for source in sources:
        url=source['url']
        if url in seen:continue
        seen.add(url)
        try:
            data=fetch(url);assert 100<=len(data)<=2_000_000
            im=Image.open(io.BytesIO(data));im.load()
            assert im.format in {'PNG','JPEG','WEBP'} and 80<=im.width<=4096 and 80<=im.height<=4096
            filename=f"photo-{len(photos)}.{im.format.lower()}";(folder/filename).write_bytes(data)
            photos.append(dict(source,ok=True,file=filename,sha256=hashlib.sha256(data).hexdigest(),type=Image.MIME[im.format],width=im.width,height=im.height,bytes=len(data),transparent=im.convert('RGBA').getchannel('A').getextrema()[0]<255))
        except Exception as exc:photos.append(dict(source,ok=False,error=str(exc)))
    result=dict(row,pages=pages,photos=photos)
    (folder/'audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(row['id'],row['name'],sum(p['ok'] for p in photos),'images',flush=True)
    return result
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    result=list(pool.map(inspect,[r for r in rows if r.get('collect',True) and (r.get('pages') or r.get('uefaId') or r.get('urls'))]))
(cache/'audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
