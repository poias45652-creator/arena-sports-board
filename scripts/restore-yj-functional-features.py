"""Restore audited October 5 functional repairs without re-enabling speed changes."""
import json
import subprocess
from pathlib import Path

BASE = '1d674ac46a1a9b10da783193cc97b40970de1a83'
LEGACY = '5a9274fd7bef71d6f41a09c5fabf3bfdedcf7aef'
BACKUP = '44c83dda09b132d84449f0b75d54a276e724aebf'
NBA_REPAIR = 'a307db98ab4db4823fece57410e27ab70e9bdf01'

def git(*args):
    return subprocess.check_output(['git', *args])

def read(ref, path):
    return git('show', f'{ref}:{path}')

restored = []
def restore(path, ref=BACKUP):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(read(ref, path))
    restored.append({'path': path, 'sourceCommit': ref, 'mode': 'exact'})

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise RuntimeError(f'Restoration anchor is not unique: {old[:120]!r}')
    return text.replace(old, new, 1)

for path in [
    'app/api/wnba/route.ts', 'app/basketball-report-refresh.ts',
    'app/nba-board.tsx', 'app/nba-match.tsx', 'app/nba-request.ts',
    'app/sport-markets.tsx', 'lib/sport-super-markets.ts',
    'lib/wnba-current-rosters.ts', 'lib/wnba-fetch.ts', 'lib/wnba-official.ts',
    'lib/wnba-player-strength-source.ts', 'tests/basketball-loading.test.mjs',
    'tests/nba-market-aliases.test.mjs', 'tests/nba-ui.test.mjs',
    'tests/wnba-ui.test.mjs', 'tests/wnba-recovery.test.mjs',
    'tests/nba-player-strength.test.mjs',
    '.github/workflows/wnba-player-strength-sync.yml',
    '.github/workflows/nba-player-refresh-validation.yml',
]:
    restore(path)
for path in ['lib/nba-source.ts', 'lib/nba-player-strength-source.ts']:
    restore(path, NBA_REPAIR)

# Restore immediate schedule-refresh notification and the odds-change event.
# Keep all original Statcast/source reads and direct board mounting unchanged.
path = 'app/page.tsx'
legacy_page = read(LEGACY, path).decode()
assert Path(path).read_text() == legacy_page, path
before = "setUpdateNotice('正在更新資料並連接 SUPER…');\n"
after = before + "    window.dispatchEvent(new Event('arena-refresh-all'));\n"
text = replace_once(legacy_page, before, after)
text = replace_once(text, "finally{window.dispatchEvent(new Event('arena-refresh-all'));await stats;", "finally{window.dispatchEvent(new Event('arena-odds-change'));await stats;")
Path(path).write_text(text)
restored.append({'path': path, 'sourceCommit': BACKUP, 'mode': 'restore the two manual-refresh event notifications only; original source reads and rendering preserved'})

# Restore source recovery and stage diagnostics, not the result-cache wrapper.
path = 'lib/wnba-source.ts'
text = read(BACKUP, path).decode()
for line in [
    "import {createNbaAnalysisCache} from './nba-analysis-cache';\n",
    "import {nbaFixtureKey} from './nba';\n",
    "import {readyNbaAnalysis,type NbaReport} from './nba-analysis';\n",
    'const analysisCache=createNbaAnalysisCache<NbaReport>({ttl:60000,maxEntries:32,maxPending:8});\n',
]:
    text = replace_once(text, line, '')
text = replace_once(text, 'analyzeEfficiency,DEFAULT_WEIGHTS,weightKey,type Weights', 'analyzeEfficiency,DEFAULT_WEIGHTS,type Weights')
text = replace_once(text, ' const key=`${nbaFixtureKey(game)}:${weightKey(weights)}`;\n const result=await analysisCache.read(key,async()=>{\n', '')
text = replace_once(text, " },report=>!!readyNbaAnalysis(game,report,Date.now(),false,weightKey(weights))&&!!report.analysis&&'playerContext' in report.analysis&&report.analysis.playerContext?.status==='applied');\n return result.value;\n", '')
Path(path).write_text(text)
restored.append({'path': path, 'sourceCommit': BACKUP, 'mode': 'functional recovery only; no analysis-result cache'})

# Keep validated WNBA transport recovery while removing build-seed integration.
path = 'lib/basketball-efficiency-source.ts'
text = read(BACKUP, path).decode()
text = replace_once(text, "import {readNbaSeed,recordNbaSeed} from './nba-public-cache-seed';\n", '')
start = text.index(" const seed=readNbaSeed('efficiency',key,24*3600000);\n")
end = text.index(" if(queue.length>=160)", start)
text = text[:start] + text[end:]
text = replace_once(text, "   recordNbaSeed('efficiency',key,{header:league==='WNBA'?raw.header:{id:raw.header.id,competitions:raw.header.competitions},boxscore:{teams:raw.boxscore.teams}},capturedAt);\n", '')
Path(path).write_text(text)
restored.append({'path': path, 'sourceCommit': BACKUP, 'mode': 'WNBA transport recovery only; no seed reading or capture'})

# The pre-speed full source loads, models, photos, and user security stay intact.
legacy_paths = [
    'app/football-board.tsx', 'app/use-source.ts', 'app/pregame.tsx',
    'app/game-context.tsx', 'app/standings.tsx', 'app/international-board.tsx',
    'app/international-live-feed.tsx', 'app/use-sport-live.ts', 'app/use-league-live.ts',
    'lib/nba-official.ts', 'lib/covers-fetch.ts', 'lib/playsport-pregame.ts',
    'instrumentation.ts', 'scripts/render-prepare.mjs', 'next.config.ts',
    'app/login/page.tsx', 'app/api/baseball/route.ts',
]
for path in legacy_paths:
    assert Path(path).read_bytes() == read(LEGACY, path), path
preserved = [
    'app/admin-access.ts', 'app/api/admin/accounts/route.ts', 'lib/hr9988.ts',
    'lib/tz-login.ts', 'app/api/free-trial/route.ts',
    'data/nba-player-strength.json', 'data/wnba-player-strength.json',
    'lib/basketball-efficiency.ts', 'lib/nba.ts', 'lib/wnba.ts', 'lib/football.ts',
    'lib/nba-player-strength.ts', 'lib/wnba-player-strength.ts',
    'scripts/nba-player-strength.py', 'scripts/wnba-player-strength.py',
]
for path in preserved:
    assert Path(path).read_bytes() == read(BASE, path), path
for root in ['public', 'db', 'drizzle']:
    assert not git('diff', '--name-only', BASE, '--', root).strip(), root

# Classify every path removed by the preceding rollback.
deleted = git('diff', '--name-only', '--diff-filter=D', BACKUP, BASE).decode().splitlines()
missing = [path for path in deleted if not Path(path).exists()]
performance_only = {
    '.github/workflows/nba-loading-verify.yml', '.github/workflows/yj-loading-verify.yml',
    '.github/workflows/yj-nba-pairing-verification.yml', '.github/workflows/yj-resilience-verify.yml',
    '.github/workflows/yj-wnba-coldstart.yml', '.github/workflows/yj-wnba-recovery.yml',
    'app/live-request.ts', 'app/login/background-video.tsx', 'app/navigation-work.ts',
    'lib/nba-analysis-cache.ts', 'lib/nba-official-cache.ts', 'lib/nba-public-cache-seed.ts',
    'lib/nba-startup-warmup.ts', 'lib/wnba-startup-warmup.ts',
    'scripts/benchmark-nba-loading.mjs', 'scripts/measure-yj-loading.mjs',
    'scripts/prepare-nba-public-cache.mjs', 'scripts/prepare-wnba-public-cache.mjs',
    'scripts/probe-nba-page-data.mjs', 'scripts/verify-nba-seeded-load.mjs',
    'scripts/verify-wnba-seeded-analysis.mjs', 'server/runtime-cache.mjs',
    'server/source-resilience.mjs', 'tests/nba-public-seed.test.mjs',
    'tests/nba-speed.test.mjs', 'tests/render-international-view-loading.test.mjs',
    'tests/render-request-cleanup.test.mjs', 'tests/render-runtime-resilience.test.mjs',
    'tests/render-shared-live-requests.test.mjs', 'tests/wnba-seed-recovery.test.mjs',
    'tests/yj-loading-performance.test.mjs',
}
assert set(missing) <= performance_only, f'Unclassified removed files: {set(missing) - performance_only}'
report = {
    'baseline': BASE, 'preSpeedRuntime': LEGACY, 'fullBackup': BACKUP,
    'scope': 'YJ only; restore removed functional repairs and preserve pre-speed entry/source-loading behavior',
    'restored': restored, 'legacyRuntimeVerified': legacy_paths,
    'entryPage': 'identical to pre-speed page except restoring immediate refresh and odds-change notifications',
    'preservedVerified': preserved,
    'notReactivatedPerEarlierUserRequest': missing,
    'performanceBackupBranch': 'backup/yj-before-user-rollback-20261005-1435',
    'notes': ['No database or account mutation.', 'No hosting/environment change.',
              'No authentication bypass.', 'Public source tests do not prove a logged-in member market response.'],
}
Path('reports').mkdir(exist_ok=True)
Path('reports/yj-functional-restoration-20261005.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'restoredFiles': len(restored), 'deletedPathsAudited': len(deleted), 'performanceOnlyNotReactivated': len(missing)}, ensure_ascii=False))
