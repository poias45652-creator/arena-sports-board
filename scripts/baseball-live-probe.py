#!/usr/bin/env python3
"""Bounded public-source integration probe. No login, keys, or access bypass.
Fetched time is not event time. Pregame placeholders are not live scores.
"""
import datetime as dt, json, os, re, time, urllib.request, urllib.error, urllib.parse, http.cookiejar
from html.parser import HTMLParser
from pathlib import Path
TZ=dt.timezone(dt.timedelta(hours=8)); NOW=dt.datetime.now(TZ); DAY=NOW.date().isoformat(); YEAR=NOW.year
OUT=Path('baseball-probe-v2'); OUT.mkdir(exist_ok=True)
ALLOWED={'api-gw.sports.naver.com','baseball.yahoo.co.jp','www.cpbl.com.tw','tw.sports.yahoo.com','www.fengyuncai.com','gogiantsports.com'}
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),NoRedirect())
results=[]
def stamp(): return dt.datetime.now(dt.timezone.utc).isoformat()
def save(name,data): (OUT/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
def get(name,url,data=None,headers=None):
    row={'id':name,'url':url,'requestedAt':stamp()}; results.append(row)
    try:
        if urllib.parse.urlparse(url).hostname not in ALLOWED: raise ValueError('Host not allowed')
        h={'User-Agent':'YJBaseballSourceCheck/1.0','Accept':'application/json,text/html;q=0.8'}; h.update(headers or {})
        body=urllib.parse.urlencode(data).encode() if data is not None else None
        req=urllib.request.Request(url,data=body,headers=h)
        with opener.open(req,timeout=20) as response:
            row.update(httpStatus=response.status,serverDate=response.headers.get('Date'),cacheControl=response.headers.get('Cache-Control'),age=response.headers.get('Age'))
            raw=response.read(6000001)
            if len(raw)>6000000: raise ValueError('6 MB response cap')
            row['bytes']=len(raw)
            enc=response.headers.get_content_charset() or 'utf8'
            try: text=raw.decode(enc)
            except (UnicodeError,LookupError): text=raw.decode('big5',errors='replace')
            row['fetchedAt']=stamp()
            try: return json.loads(text)
            except ValueError: return text
    except urllib.error.HTTPError as e: row.update(httpStatus=e.code,error=str(e),location=e.headers.get('Location')); return None
    except Exception as e: row['error']=type(e).__name__+': '+str(e); return None
    finally:
        row['completedAt']=stamp(); print('HTTP_OBSERVATION '+json.dumps(row,ensure_ascii=False),flush=True)
class N:
    def __init__(self,tag='',attrs=None,parent=None): self.tag=tag; self.attrs=dict(attrs or []); self.parent=parent; self.children=[]
    def all(self,tag=None):
        for c in self.children:
            if isinstance(c,N):
                if tag is None or c.tag==tag: yield c
                yield from c.all(tag)
    def text(self):
        return re.sub(r'\s+',' ',' '.join(c.text() if isinstance(c,N) else c for c in self.children)).strip()
class Tree(HTMLParser):
    def __init__(self): super().__init__(); self.root=N(); self.cur=self.root
    def handle_starttag(self,t,a):
        n=N(t,a,self.cur); self.cur.children.append(n)
        if t not in {'br','img','input','hr','meta','link','source','wbr','area','base','embed','param','track','col'}: self.cur=n
    def handle_endtag(self,t):
        n=self.cur
        while n.parent and n.tag!=t: n=n.parent
        if n.parent:self.cur=n.parent
    def handle_data(self,d):
        if self.cur.tag not in {'script','style'}: self.cur.children.append(d)
def htmlfacts(name,text):
    if not isinstance(text,str):return {}
    p=Tree();p.feed(text);r=p.root
    titles=[n.text() for n in r.all('title')]
    tables=[]
    for table in r.all('table'):
        rows=[]
        for tr in table.all('tr'):
            cells=[{'text':n.text(),'class':n.attrs.get('class',''),'colspan':n.attrs.get('colspan'),'rowspan':n.attrs.get('rowspan')} for n in tr.children if isinstance(n,N) and n.tag in ('th','td')]
            if cells: rows.append(cells)
        if rows: tables.append({'id':table.attrs.get('id'),'class':table.attrs.get('class'),'rows':rows[:70]})
    links=[]
    for a in r.all('a'):
        href=a.attrs.get('href','')
        if re.search(r'/npb/game/\d+|/cpbl/[^/]+-\d+|/match/\d+|/box[/?]|/schedule',href):links.append({'href':href,'text':a.text()[:100]})
    scoreboard=[]
    for n in r.all():
        cl=n.attrs.get('class',''); txt=n.text()
        if re.search(r'bb-score__|bb-gameScore|bb-gameInfo|bb-live|bb-game|bb-scoreTable|bb-match',cl) and txt and len(txt)<1400:scoreboard.append({'tag':n.tag,'class':cl,'text':txt,'href':n.attrs.get('href')})
    endpoints=sorted(set(re.findall(r'(?:url\s*:\s*|fetch\()\s*[\'\"]([^\'\"]+)[\'\"]',text)))
    factual={'sourceTitles':titles,'tables':tables[:35],'gameLinks':links[:70],'scoreElements':scoreboard[:160],'declaredPublicPaths':endpoints[:40]}
    save(name,factual);print('HTML_FIELDS '+json.dumps({'id':name,'titles':titles,'tables':len(tables),'gameLinks':links[:9],'endpoints':endpoints[:30]},ensure_ascii=False),flush=True)
    return factual

def factual_json(x,depth=0):
    if depth>12:return None
    if isinstance(x,dict):return {k:factual_json(v,depth+1) for k,v in x.items() if not re.search(r'cookie|secret|token|authorization|password|comment|chzzk|liveList|stream|thumbnail|image|cheer|embed|broadcaster|^pv$|^cv$|peak|relatedGames',k,re.I)}
    if isinstance(x,list):return [factual_json(v,depth+1) for v in x[:300]]
    if isinstance(x,str) and len(x)>1500:return '[long nonnumeric text omitted]'
    return x
print('PROBE_START '+json.dumps({'date':DAY,'startedAt':stamp(),'mode':'bounded-technical-verification'}),flush=True)
nav='https://api-gw.sports.naver.com'
for offset in (0,-2):
    d=(NOW.date()+dt.timedelta(days=offset)).isoformat();label='today' if offset==0 else 'recent-final'
    u=nav+'/schedule/games?'+urllib.parse.urlencode({'upperCategoryId':'kbaseball','fromDate':d,'toDate':d,'page':1,'pageSize':100})
    j=get('kbo-'+label,u)
    games=[g for g in (j or {}).get('result',{}).get('games',[]) if g.get('categoryId')=='kbo' and g.get('homeTeamCode') and g.get('awayTeamCode')]
    save('kbo-'+label+'-games',{'date':d,'fetchedAt':stamp(),'games':games})
    print('KBO_GAMES '+json.dumps({'date':d,'games':games},ensure_ascii=False),flush=True)
    if games:
        gid=games[0]['gameId']
        if re.fullmatch(r'[A-Za-z0-9_-]{5,40}',gid):
            for path in ('game-polling','relay','record'):
                result=get('kbo-'+label+'-'+path,nav+'/schedule/games/'+gid+'/'+path)
                if isinstance(result,dict):
                    clean=factual_json(result);save('kbo-'+label+'-'+path,clean)
                    print('KBO_DETAIL '+json.dumps({'id':gid,'endpoint':path,'data':clean},ensure_ascii=False)[:18000],flush=True)
npb=get('npb-schedule','https://baseball.yahoo.co.jp/npb/schedule/?date='+DAY);f=htmlfacts('npb-schedule',npb)
ids=[]
for a in f.get('gameLinks',[]):
    m=re.search(r'/npb/game/(\d+)/',a['href'])
    if m and m[1] not in ids:ids.append(m[1])
for index in (0,6):
    if index<len(ids):
        gid=ids[index]
        for page in ('top','score','stats'):
            body=get('npb-'+gid+'-'+page,'https://baseball.yahoo.co.jp/npb/game/'+gid+'/'+page);htmlfacts('npb-'+gid+'-'+page,body)
cpbl=get('cpbl-box-page','https://www.cpbl.com.tw/box/live?year='+str(YEAR)+'&kindCode=A&gameSno=331');htmlfacts('cpbl-box-page',cpbl)
schedule=get('cpbl-schedule-index','https://www.cpbl.com.tw/schedule/index');sf=htmlfacts('cpbl-schedule-index',schedule)
if isinstance(schedule,str):
    m=re.search(r'RequestVerificationToken\s*:\s*[\'\"]([^\'\"]+)[\'\"]',schedule)
    if m:
        j=get('cpbl-schedule-json','https://www.cpbl.com.tw/schedule/getgamedatas',{'calendar':DAY.replace('-','/'),'location':'','kindCode':'A'},{'RequestVerificationToken':m[1],'Referer':'https://www.cpbl.com.tw/schedule/index'})
        if isinstance(j,dict):
            raw=j.get('GameDatas',[])
            try: games=json.loads(raw) if isinstance(raw,str) else raw
            except ValueError:games=[]
            chosen=[g for g in games if str(g.get('GameDate','')).startswith(DAY)];save('cpbl-today-games',chosen)
            print('CPBL_TODAY '+json.dumps(chosen,ensure_ascii=False),flush=True)
for gid in (331,282):
    j=get('cpbl-'+str(gid)+'-live','https://www.cpbl.com.tw/box/getlive',{'GameSno':str(gid),'Year':str(YEAR),'KindCode':'A'},{'Referer':'https://www.cpbl.com.tw/box'})
    if isinstance(j,dict):
        decoded={}
        for k,v in j.items():
            try:decoded[k]=json.loads(v) if isinstance(v,str) else v
            except ValueError:decoded[k]=v
        clean=factual_json(decoded);save('cpbl-'+str(gid)+'-live',clean)
        print('CPBL_DETAIL '+json.dumps({'gameSno':gid,'data':clean},ensure_ascii=False)[:20000],flush=True)
for name,u in [('cpbl-yahoo-team','https://tw.sports.yahoo.com/cpbl/teams/'+urllib.parse.quote('富邦')+'/'),('cpbl-fengyuncai','https://www.fengyuncai.com/asp/cpbl.asp'),('cpbl-gogiant','https://gogiantsports.com/match/44178')]:
    body=get(name,u);f=htmlfacts(name,body)
    if isinstance(body,str):
        m=re.search(r'<script[^>]*id=[\'\"]__NEXT_DATA__[\'\"][^>]*>(.*?)</script>',body,re.S)
        if m:
            try:save(name+'-page-data',factual_json(json.loads(m[1])))
            except ValueError:pass
save('results',{'date':DAY,'completedAt':stamp(),'results':results})
print('PROBE_END '+json.dumps({'http200':sum(x.get('httpStatus')==200 for x in results),'requests':len(results),'completedAt':stamp()}),flush=True)
