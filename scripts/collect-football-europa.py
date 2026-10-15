"""Read public ESPN results for reproducible Europa calibration and regressions."""
import concurrent.futures, datetime, json, pathlib, sys, urllib.request

out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.football-research/europa')
out.mkdir(parents=True, exist_ok=True)
root = 'https://site.api.espn.com/apis/site/v2/sports/soccer/'

def collect(item):
    name, url = item
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'YJ-public-football-audit/1.0'}), timeout=40) as response:
        body = json.load(response)
    if not isinstance(body.get('events'), list) or len(body['events']) >= 1000:
        raise ValueError('Incomplete events: ' + name)
    (out / (name + '.json')).write_text(json.dumps(body, ensure_ascii=False))
    return {'file': name + '.json', 'url': url, 'events': len(body['events'])}

requests = [(f'annual-{year}', root + f'uefa.europa/scoreboard?dates={year}&limit=1000') for year in range(2011, 2027)]
requests.append(('schedule-20261015', root + 'uefa.europa/scoreboard?dates=20261015&limit=1000'))
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    sources = list(pool.map(collect, requests))
schedule = json.loads((out / 'schedule-20261015.json').read_text())
teams = sorted({c['team']['id'] for e in schedule['events'] for c in e['competitions'][0]['competitors']})
requests = [(f'team-{league.replace(".", "-")}-{team}-{year}', root + f'{league}/teams/{team}/schedule?season={year}') for team in teams for league in ['uefa.europa', 'all'] for year in [2025, 2026]]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    sources += list(pool.map(collect, requests))
(out / 'manifest.json').write_text(json.dumps({'collectedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'sources': sources}, indent=2))
print(json.dumps({'files': len(sources), 'teams': len(teams), 'annualEvents': {s['file']: s['events'] for s in sources if s['file'].startswith('annual')}))
