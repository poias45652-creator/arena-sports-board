"""Build an additive Europa catalog from reviewed, byte-verified source caches.

Run only after reviewing non-exact identities and the club portrait images.
The existing competitions' catalog, sources and historical audit stay intact.
"""
import datetime
import hashlib
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
cache = Path(sys.argv[1])
def read(path):
    return json.loads(path.read_text())
def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')

existing = read(root / 'data/football-player-photos.json')['players']
existing_sources = read(root / 'data/football-reviewed-photo-sources.json')
players = read(cache / 'espn-players.json')
rosters = read(cache / 'espn-rosters.json')
verified = read(cache / 'verified.json')
matched = read(cache / 'matched.json')
images = read(cache / 'photo-audit.json')
assert all(r['team']['league'] == 'uefa.europa' and not r.get('error') for r in rosters)
overrides = read(root / 'data/football-player-photo-overrides.json')
alias_evidence = {
    '388235': 'https://www.tff.org/Default.aspx?kisiId=2143735&pageId=30',
    '410543': 'https://www.rsca.be/en/noa-ojea-2029',
    '362824': 'https://sport.tvp.pl/89989333/reprezentacja-polski-filip-rozga-na-pierwszym-zgrupowaniu-reprezentacji-polski-przyjechalem-by-zagrac',
}
added = {}
proofs = {}
for eid, row in verified.items():
    if eid in existing:
        assert not existing[eid].get('providerId') or existing[eid]['providerId'] == row['providerId'], eid
        continue
    photo = images[row['providerId']]
    assert photo['ok'] and photo['transparent']
    data = (cache / 'photos' / (row['providerId'] + '.png')).read_bytes()
    assert hashlib.sha256(data).hexdigest() == photo['sha256']
    source = players[eid]
    added[eid] = {'name': source['displayName'], 'birthDate': str(source.get('dateOfBirth') or '')[:10], 'providerId': row['providerId']}
    proofs[eid] = dict(row, photo=photo, evidence=overrides.get(eid, {}).get('evidence') or alias_evidence.get(eid))

club_sources = {}
club_path = cache / 'reviewed-club-photos/audit.json'
club_checks = read(club_path) if club_path.exists() else []
for row in club_checks:
    if not row['ok']:
        continue
    eid = row['id']
    assert eid not in existing and eid not in added and eid not in existing_sources
    data = (cache / 'reviewed-club-photos' / row['file']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == row['sha256']
    source = players[eid]
    assert row['name'] == source['displayName'] and row['number'] == source['jersey'] and row['teams'] == source['teams']
    added[eid] = {'name': source['displayName'], 'birthDate': str(source.get('dateOfBirth') or '')[:10]}
    club_sources[eid] = {key: row[key] for key in ('url', 'sha256', 'type')}
    proofs[eid] = row

known = {eid for eid, p in existing.items() if p.get('providerId') or p.get('sourceUrl') or eid in existing_sources} | set(added)
covered = set(players) & known
missing = []
for eid, player in players.items():
    if eid not in covered:
        missing.append({'id': eid, 'name': player['displayName'], 'teams': player['teams'],
                        'reason': images[matched[eid]['providerId']]['error'] if eid in matched else 'No unambiguous identity match',
                        'providerId': matched.get(eid, {}).get('providerId')})
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
save(root / 'data/football-europa-player-photos.json', {'version': 1, 'season': 2026, 'verifiedAt': stamp, 'players': added})
save(root / 'data/football-europa-reviewed-photo-sources.json', club_sources)
save(root / 'docs/football-europa-photo-audit.json', {
    'verifiedAt': stamp, 'season': 2026, 'league': 'uefa.europa', 'uniquePlayers': len(players),
    'previouslyCataloguedPhotos': len(covered) - len(added), 'addedPhotos': len(added),
    'addedTransparentPhotos': sum(p.get('photo', p).get('transparent', False) for p in proofs.values()),
    'cataloguedPhotos': len(covered), 'source': 'ESPN 2026 Europa rosters; FotMob identity and portrait checks; reviewed official club portraits',
    'teams': [dict(id=r['team']['id'], name=r['team']['name'], total=len(r['players']), withPhoto=sum(str(p['id']) in covered for p in r['players'])) for r in rosters],
    'added': proofs, 'missing': missing, 'clubSourceChecks': club_checks,
})
print('Added', len(added), 'portraits;', len(covered), '/', len(players), 'covered;', len(missing), 'remaining')
