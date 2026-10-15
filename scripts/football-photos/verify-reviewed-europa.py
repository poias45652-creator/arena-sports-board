"""Verify explicitly reviewed club portrait URLs; preserve the original bytes."""
import concurrent.futures
import hashlib
import io
import json
import sys
import urllib.request
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
cache = Path(sys.argv[1]) / 'reviewed-club-photos'
cache.mkdir(parents=True, exist_ok=True)
candidates = json.loads((root / 'docs/football-europa-reviewed-photo-candidates.json').read_text())

def verify(row):
    try:
        with urllib.request.urlopen(row['url'], timeout=25) as response:
            assert response.headers.get('content-type', '').startswith('image/')
            data = response.read(2_000_001)
        assert 100 <= len(data) <= 2_000_000
        photo = Image.open(io.BytesIO(data))
        photo.load()
        assert photo.format in {'PNG', 'WEBP', 'JPEG'}
        assert 80 <= photo.width <= 2048 and 80 <= photo.height <= 2048
        mime = Image.MIME[photo.format]
        extension = {'image/png': '.png', 'image/webp': '.webp', 'image/jpeg': '.jpg'}[mime]
        filename = row['id'] + extension
        (cache / filename).write_bytes(data)
        return dict(row, ok=True, file=filename, type=mime, bytes=len(data),
                    sha256=hashlib.sha256(data).hexdigest(), width=photo.width,
                    height=photo.height, transparent=photo.convert('RGBA').getchannel('A').getextrema()[0] < 255)
    except Exception as exc:
        return dict(row, ok=False, error=str(exc))

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(verify, candidates))
(cache / 'audit.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
print('Reviewed club portraits verified', sum(r['ok'] for r in results), 'of', len(results), flush=True)
