"""Collect official UEFA page evidence for manual portrait review; never publishes it."""
import concurrent.futures
import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from bs4 import BeautifulSoup

cache = Path(sys.argv[1]) / 'uefa-research'
cache.mkdir(parents=True, exist_ok=True)
root = 'https://www.uefa.com'

def page(url):
    key = hashlib.sha256(url.encode()).hexdigest()[:20]
    try:
        with urllib.request.urlopen(url, timeout=25) as response:
            raw = response.read(2_000_001)
        assert len(raw) <= 2_000_000
        (cache / (key + '.html')).write_bytes(raw)
        soup = BeautifulSoup(raw, 'html.parser')
        links = sorted({urllib.parse.urljoin(url, a['href']) for a in soup.select('a[href]')})
        images = [dict(tag=x.name, **x.attrs) for x in soup.find_all() if any('src' in a or 'image' in a or 'avatar' in a for a in x.attrs)]
        return {'url': url, 'file': key + '.html', 'links': links, 'images': images}
    except Exception as exc:
        return {'url': url, 'error': str(exc)}

index = page(root + '/uefaeuropaleague/clubs/')
clubs = [url for url in index.get('links', []) if re.fullmatch(r'https://www\.uefa\.com/uefaeuropaleague/clubs/\d+--[^/]+/', url)]
# Public squad pages provide named player links and image attributes for review.
urls = [url + 'squad/' for url in clubs]
urls.append(root + '/uefaeuropaleague/clubs/players/250222293--omar-sarr/')
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    pages = [index, *pool.map(page, urls)]
(cache / 'index.json').write_text(json.dumps(pages, ensure_ascii=False, indent=2))
print('UEFA evidence pages', len(pages), 'errors', sum('error' in p for p in pages), flush=True)
