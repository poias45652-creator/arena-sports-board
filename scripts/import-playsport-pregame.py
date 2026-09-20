"""Import a dated, locally captured Playsport page set; never fetch or guess missing data.

Usage: python scripts/import-playsport-pregame.py NPB capture.json output.json
Capture format: {observedAt: ISO timestamp, results: [{url, title, text: HTML}]}.
"""
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

class Tables(HTMLParser):
    def __init__(self):
        super().__init__(); self.tables=[]; self.stack=[]
    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            table={'rows': [], 'cell': False}; self.tables.append(table); self.stack.append(table)
        if not self.stack: return
        table=self.stack[-1]
        if tag in ('tr','row'): table['rows'].append([]); table['cell']=False
        elif tag in ('td','th','cell') and table['rows']:
            table['rows'][-1].append(''); table['cell']=True
    def handle_data(self, text):
        if self.stack and self.stack[-1]['cell']:
            self.stack[-1]['rows'][-1][-1] += text
    def handle_endtag(self, tag):
        if not self.stack: return
        if tag == 'table': self.stack.pop()
        elif tag in ('td','th','cell','tr','row'): self.stack[-1]['cell']=False
    def rows(self):
        return [[[' '.join(c.split()) for c in r] for r in t['rows']] for t in self.tables]

TEAMS={
 'NPB': [('s','東京養樂多燕子','養樂多'),('g','讀賣巨人','巨人'),('b','歐力士猛牛','歐力士'),('f','北海道日本火腿鬥士','火腿'),('h','福岡軟銀鷹','軟銀'),('e','東北樂天金鷲','樂天'),('c','廣島東洋鯉魚','廣島'),('d','中日龍','中日'),('db','橫濱 DeNA 海灣之星','橫濱'),('t','阪神虎','阪神'),('l','埼玉西武獅','西武'),('m','千葉羅德海洋','羅德')],
 'CPBL': [('AAA','味全龍','味全'),('ACN','中信兄弟','兄弟'),('AEO','富邦悍將','富邦'),('ADD','統一獅','統一'),('AKP','台鋼雄鷹','台鋼'),('AJL','樂天桃猿','樂天')],
}
TIMES={'NPB':['13:00']*3+['17:00']*3,'CPBL':['15:05','16:05','17:05']}
FIELDS=['wins','losses','era','opponentAverage','innings','strikeouts','walks','whip']

def outs(value):
    m=re.fullmatch(r'(\d+)(?:\.([012]))?',value)
    if not m: raise ValueError('Invalid baseball innings: '+value)
    return int(m[1])*3+int(m[2] or 0)

def table(title, headers, rows):
    if any(len(row)!=len(headers) for row in rows): raise ValueError('Misaligned '+title)
    return {'title':title,'headers':headers,'rows':rows}

def parse(league, capture):
    games=[]; pages=capture['results']; observed=capture['observedAt']
    if len(pages)!=len(TIMES[league]): raise ValueError('Incomplete capture')
    for index,page in enumerate(pages):
        gid=re.search(r'gameid=(\d+)',page['url']).group(1)
        if not gid.startswith('20260920') or not gid.endswith(str(1001+index)): raise ValueError('Wrong game/date')
        title=page['title']; html=page['text']; parser=Tables(); parser.feed(html); tables=parser.rows()
        date='2026-09-20'; game={'id':gid,'league':league,'date':date,'start':date+' '+TIMES[league][index]+':00','kind':'pregame_snapshot','liveVerified':False,
          'source':{'name':'玩運彩','url':page['url'].split('#')[0],'observedAt':observed,'publishedAt':None,'sourceTitle':title,'contentSha256':hashlib.sha256(html.encode()).hexdigest()}}
        bat=[t for t in tables if t and t[0] and t[0][0]=='團隊打擊(排名)']
        pit=[(i,t) for i,t in enumerate(tables) if t and t[0] and t[0][0]=='勝' and 'whip' in t[0]]
        if len(bat)!=2 or (league=='NPB' and len(pit)!=2): raise ValueError('Missing expected tables')
        for s,side in enumerate(['away','home']):
            code,name,short=TEAMS[league][index*2+s]
            if short not in title or '2026/9/20' not in title: raise ValueError('Source matchup mismatch')
            starter={'name':'','throws':None,'season':dict.fromkeys(FIELDS,''),'splits':table('投手分項成績',[],[]),'recent':table('逐場出賽紀錄',[],[]),'quality':'unavailable','warnings':['來源尚未公布先發投手與投手成績。']}
            bullpen=None
            if pit:
                ti,rows=pit[s]; prefix=tables[ti-1][0][0]
                if not prefix.startswith(short+' '): raise ValueError('Pitcher team mismatch')
                pitcher=prefix[len(short)+1:]; season=next(r for r in rows if r[0]=='本季')
                bullpen_row=next(r for r in rows if r[0]=='球隊牛棚')
                if len(season)!=9 or len(bullpen_row)!=9: raise ValueError('Pitcher columns')
                recent=tables[ti+1]; recent_rows=[]
                for row in recent[1:]:
                    row=list(row)
                    # The normalized capture omits blank decision cells, but retains pitch count.
                    if len(row)==11 and re.fullmatch(r'\d+',row[3]): row.insert(3,'')
                    if re.fullmatch(r'\d{2}/\d{2}',row[0]): row[0]='2026-'+row[0].replace('/','-')
                    if len(row)!=12 or not re.fullmatch(r'2026-\d{2}-\d{2}',row[0]) or row[0]>=date: raise ValueError('Appearance date/columns')
                    recent_rows.append(row)
                stats=dict(zip(FIELDS,season[1:])); warnings=[]
                if sum(outs(r[5]) for r in recent_rows)>outs(stats['innings']): warnings.append('本季投球局數少於頁面逐場紀錄加總，投手成績待核對。')
                starter={'name':pitcher,'throws':None,'season':stats,'splits':table('投手分項成績',['分類']+rows[0],[r for r in rows[1:] if r[0]!='球隊牛棚']),
                  'recent':table('逐場出賽紀錄',recent[0],recent_rows),'quality':'needs_review' if warnings else 'source_reported','warnings':warnings}
                bullpen=dict(zip(FIELDS,bullpen_row[1:]))
            batting_rows=[r for r in bat[s][1:] if not (len(r)==1 and r[0].startswith('括號'))]
            game[side]={'team':name,'teamCode':code,'sourceTeam':short,'starter':starter,'bullpen':bullpen,'batting':table('團隊打擊',bat[s][0],batting_rows)}
            by_label={r[0]:r for r in batting_rows}
            if all(label in by_label for label in ['主','客','本賽季']):
                number=lambda value: int(re.match(r'\d+',value).group())
                inconsistent=[bat[s][0][i] for i in [5,6,7] if number(by_label['主'][i])+number(by_label['客'][i])!=number(by_label['本賽季'][i])]
                if inconsistent:
                    game[side]['battingWarnings']=['本季'+ '、'.join(inconsistent)+'與主客場合計不一致，團隊打擊成績待核對。']
        # Source comparison rows use one category cell for each away/home pair.
        comparison=next((t for t in tables if t and '客場得/失分' in t[0]),None)
        if comparison:
            category=''; output=[]; side_index=0
            for row in comparison[1:]:
                values=list(row)
                if values[0] in ('對戰','本季','近十場'):
                    category=values.pop(0); side_index=0
                if len(values)!=6 or side_index>1: raise ValueError('Comparison columns')
                side=['away','home'][side_index]; output.append([category,game[side]['team']]+values)
                if category=='本季': game[side]['record']=values[0]
                side_index+=1
            game['comparison']=table('球隊戰績與得失分',comparison[0],output)
        games.append(game)
    return {'schemaVersion':1,'league':league,'season':2026,'date':'2026-09-20','observedAt':observed,'games':games}

if __name__=='__main__':
    league,source,target=sys.argv[1:]
    result=parse(league,json.loads(Path(source).read_text()))
    Path(target).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'league':league,'games':len(result['games']),'pitchers':sum(bool(g[s]['starter']['name']) for g in result['games'] for s in ['away','home']),
      'review':[g[s]['starter']['name'] for g in result['games'] for s in ['away','home'] if g[s]['starter']['quality']=='needs_review'],
      'appearances':sum(len(g[s]['starter']['recent']['rows']) for g in result['games'] for s in ['away','home'])},ensure_ascii=False))
