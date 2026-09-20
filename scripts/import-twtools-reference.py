"""Import inspected, third-party HTML captures; never follows upstream links.

Usage: python scripts/import-twtools-reference.py captures.json --observed-at ISO
Captures are [{url, text}]. This is a dated admin reference, not a live/model feed.
"""
import argparse
import hashlib
import json
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOME = 'https://baseball.twtools.cc/'
DIVISIONS = ['美聯東區', '美聯中區', '美聯西區', '國聯東區', '國聯中區', '國聯西區']
IDS = {
    'CPBL': {'中信兄弟': 1, '統一7-ELEVEn獅': 2, '富邦悍將': 3, '樂天桃猿': 4, '味全龍': 5, '台鋼雄鷹': 6},
    'NPB': {'讀賣巨人': 1, '阪神虎': 2, '橫濱DeNA灣星': 3, '中日龍': 4, '廣島東洋鯉魚': 5, '養樂多燕子': 6,
            '福岡軟銀鷹': 7, '北海道日本火腿鬥士': 8, '歐力士猛牛': 9, '東北樂天金鷲': 10, '埼玉西武獅': 11, '千葉羅德海洋': 12},
    'KBO': {'KT巫師': 1, 'LG 雙子': 2, 'NC 恐龍': 3, 'SSG 登陸者': 4, '三星獅': 5, '起亞虎': 6,
            '斗山熊': 7, '韓華鷹': 8, '樂天巨人': 9, 'Kiwoom 英雄': 10},
}


class Capture(HTMLParser):
    def __init__(self, page):
        super().__init__()
        self.tables, self.fragments = [], []
        self.in_table, self.cell = False, None
        self.feed(page['text'])
        self.text = ' '.join(self.fragments)
        self.url = page['url']
        self.digest = hashlib.sha256(page['text'].encode()).hexdigest()

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.in_table, self.rows = True, []
        elif tag == 'tr':
            self.row = []
        elif tag in ('th', 'td'):
            self.cell = []

    def handle_endtag(self, tag):
        if tag in ('th', 'td') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        elif tag == 'tr':
            self.rows.append(self.row)
        elif tag == 'table':
            self.tables.append(self.rows)
            self.in_table = False

    def handle_data(self, value):
        if self.cell is not None:
            self.cell.append(value)
        elif not self.in_table and value.strip():
            self.fragments.append(value.strip())


def date_match(pattern, text):
    m = re.search(pattern, text)
    if not m:
        raise ValueError('Source date not found: ' + pattern)
    datetime.strptime(m[1], '%Y-%m-%d')
    return m[1]


def table(title, raw, has_header=True):
    headers = raw[0] if has_header else ['名次', '球員', '球隊', title]
    rows = raw[1:] if has_header else raw
    if not rows or any(len(row) != len(headers) for row in rows):
        raise ValueError('Incomplete table: ' + title)
    return {'title': title, 'headers': headers, 'rows': rows}


def validate_standings(tables, expected):
    rows = [dict(zip(t['headers'], r)) for t in tables for r in t['rows']]
    if len(rows) != expected or len({r['球隊'] for r in rows}) != expected:
        raise ValueError('Incomplete or duplicate standings')
    for r in rows:
        w, l, ties = int(r['勝']), int(r['敗']), int(r.get('和', 0))
        if min(w, l, ties) < 0 or not w + l or abs(float(r['勝率']) - w / (w + l)) > .0006:
            raise ValueError('Invalid standing: ' + r['球隊'])
        if '出賽' in r and int(r['出賽']) != w + l + ties:
            raise ValueError('Game count mismatch')
        if '淨勝分' in r and int(r['淨勝分']) != int(r['得分']) - int(r['失分']):
            raise ValueError('Run differential mismatch')


def audit_games(home, history):
    # Match by date and both team IDs, independent of the page's unspecified home/away order.
    fixtures = home.text.split('戰績速覽')[0]
    cursor = fixtures.index('來源 MLB 官方 StatsAPI') + len('來源 MLB 官方 StatsAPI')
    result = []
    for league, provider, expected in [('CPBL', 'rebas.tw', 3), ('NPB', 'npb.jp', 3), ('KBO', 'sportify.tw', 5)]:
        marker = re.search(r'(\d{4}-\d{2}-\d{2}) · 來源 ' + re.escape(provider), fixtures[cursor:])
        if not marker:
            raise ValueError('Fixture date missing: ' + league)
        content = fixtures[cursor:cursor + marker.start()]
        source_date = marker[1]
        names = '|'.join(re.escape(n) for n in sorted(IDS[league], key=len, reverse=True))
        teams = re.findall('(' + names + r')(\d+)', content)
        if len(teams) != expected * 2:
            raise ValueError('Fixture count changed: ' + league)
        for first, second in zip(teams[::2], teams[1::2]):
            a, b = IDS[league][first[0]], IDS[league][second[0]]
            matches = [g for g in history[league] if g['date'] == source_date and {g['homeId'], g['awayId']} == {a, b}]
            identical = [g for g in matches if g['completed'] and
                         g['homeScore' if g['homeId'] == a else 'awayScore'] == int(first[1]) and
                         g['homeScore' if g['homeId'] == b else 'awayScore'] == int(second[1])]
            status = 'already_present' if len(matches) == 1 and len(identical) == 1 else 'review_required'
            result.append({'league': league, 'date': source_date, 'firstTeam': first[0], 'secondTeam': second[0],
                           'firstScore': int(first[1]), 'secondScore': int(second[1]), 'status': status,
                           'matchedGameId': identical[0]['id'] if status == 'already_present' else None,
                           'sourceUrl': HOME, 'eligibleForMemberAnalysis': False})
        cursor += marker.end()
    return result


def build(pages, observed_at, history):
    observed = datetime.fromisoformat(observed_at.replace('Z', '+00:00'))
    if observed.tzinfo is None:
        raise ValueError('Observed time must include timezone')
    captures = {p['url']: Capture(p) for p in pages if p['url'] in (HOME, HOME + 'cpbl/', HOME + 'standings/')}
    home, cpbl, mlb = (captures[url] for url in (HOME, HOME + 'cpbl/', HOME + 'standings/'))
    if len(home.tables) != 28 or len(cpbl.tables) != 11 or len(mlb.tables) != 19:
        raise ValueError('Source layout changed; review required')
    mlb_date = date_match(r'截至 (\d{4}-\d{2}-\d{2})', mlb.text)
    cpbl_date = date_match(r'截至 (\d{4}-\d{2}-\d{2})', cpbl.text)
    npb_date = date_match(r'截至 (\d{4}-\d{2}-\d{2}) · 來源 npb\.jp', home.text)
    kbo_date = date_match(r'截至 (\d{4}-\d{2}-\d{2}) · 來源 en\.wikipedia\.org', home.text)
    if '下半季' not in cpbl.text or '非自動更新' not in cpbl.text:
        raise ValueError('CPBL scope changed; review required')
    season = int(mlb_date[:4])
    if any(int(d[:4]) != season or d > observed_at[:10] for d in [mlb_date, cpbl_date, npb_date, kbo_date]):
        raise ValueError('Source dates do not match the capture season/date')
    leagues = [
        {'league': 'MLB', 'sourceAsOf': mlb_date, 'sourceUrl': mlb.url, 'scope': '例行賽全季 · 六分區',
         'standings': [table(name, mlb.tables[i]) for i, name in enumerate(DIVISIONS)],
         'leaderboards': [table(name, mlb.tables[i + 6], False) for i, name in enumerate(
             ['全壘打', '打點', '打擊率', '盜壘', 'OPS', '安打', '得分', '二壘打', '自責分率', '三振', '勝投', '救援', 'WHIP'])],
         'notes': ['每日重建的日期快照；現有 MLB 即時成績優先，未替換主要來源。',
                   '榜單包含並列名次；ERA、WHIP 是榜上個人球季數據，不是團隊牛棚數據。',
                   '抽查洋基球隊頁只有戰績、主客場與名冊；沒有牛棚近期用球／休息資料。',
                   '首頁比分未明確標示完賽狀態，沒有匯入為完賽紀錄。']},
        {'league': 'CPBL', 'sourceAsOf': cpbl_date, 'sourceUrl': cpbl.url, 'scope': '下半季戰績 · 排行統計期間未明示',
         'standings': [table('中職下半季', cpbl.tables[0])],
         'leaderboards': [table(t[0][-1], t) for t in cpbl.tables[1:]],
         'notes': [f'來源為非官方整理站的 {cpbl_date} 人工快照，沒有重新抓取中職官網。',
                   '戰績只涵蓋下半季，不能覆蓋全年戰績；排行榜只列 TOP5，統計期間未明示。',
                   '救援／中繼成功榜不能補齊牛棚總局數、責失分、WHIP 或近三日用球。',
                   '已有較新球員成績，保留舊榜單作核對，不覆蓋投手、先發或模型輸入。']},
        {'league': 'NPB', 'sourceAsOf': npb_date, 'sourceUrl': HOME, 'scope': '中央／太平洋聯盟全季戰績',
         'standings': [table('中央聯盟', home.tables[7]), table('太平洋聯盟', home.tables[8])], 'leaderboards': [],
         'notes': ['12 隊戰績日期快照；沒有日職個人球季榜單或今日先發／牛棚明細。',
                   '歷史比分逐場核對日期、雙方球隊與分數，重複紀錄不新增；結果見下方。']},
        {'league': 'KBO', 'sourceAsOf': kbo_date, 'sourceUrl': HOME, 'scope': '例行賽全季戰績',
         'standings': [table('韓職排名', home.tables[9])], 'leaderboards': [],
         'notes': [f'戰績截至 {kbo_date}，僅保存日期參考，不覆蓋較新的賽前成績。',
                   '沒有韓職今日先發、完整投手成績或牛棚近期使用量。',
                   '歷史比分核對結果見下方；沒有把舊比賽當作今日賽事。']},
    ]
    for league, expected in zip(leagues, [30, 6, 12, 10]):
        validate_standings(league['standings'], expected)
        league['teamCount'] = expected
        league['leaderboardRowCount'] = sum(len(t['rows']) for t in league['leaderboards'])
        league['eligibleForMemberAnalysis'] = False
        league['status'] = 'dated_reference'
        league['unavailable'] = ['即時盘口／賠率', '今日先發異動', '完整牛棚分項與近期用球', '逐球即時更新']
    return {'schemaVersion': 1, 'season': season, 'observedAt': observed_at, 'source': HOME + 'data/',
            'importPolicy': 'admin_reference_only', 'automaticRefreshEnabled': False,
            'leagues': leagues, 'gameAudit': audit_games(home, history),
            'captures': [{'url': c.url, 'contentSha256': c.digest,
                          'publisherCapturedAt': re.search(r'擷取時間 (\d{4}-\d{2}-\d{2}T[\d:+-]+)', c.text)[1]
                          if re.search(r'擷取時間 (\d{4}-\d{2}-\d{2}T[\d:+-]+)', c.text) else None}
                         for c in captures.values()]}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('captures', type=Path)
    parser.add_argument('--observed-at', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    baseline = json.loads((ROOT / 'data/international-profile-2026.json').read_text())
    history = {league: d['games'] for league, d in baseline['games'].items()}
    history['CPBL'] = list({g['id']: g for g in [
        *json.loads((ROOT / 'data/cpbl-daily-supplement-20260920.json').read_text())['games'], *history['CPBL']
    ]}.values())
    result = build(json.loads(args.captures.read_text()), args.observed_at, history)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({l['league']: {'teams': l['teamCount'], 'leaders': l['leaderboardRowCount'], 'asOf': l['sourceAsOf']}
                      for l in result['leagues']}, ensure_ascii=False))
    print('Already present:', sum(g['status'] == 'already_present' for g in result['gameAudit']))
