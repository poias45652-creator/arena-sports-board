"""Read public category metadata and official fixture identities, without login."""
import datetime,json,pathlib,sys,urllib.request,urllib.error
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
sources={
 'super-categories':'https://hr9988.net/api/GameInfo/GameOnlyCatID/tw',
 'europa-20261015':'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/scoreboard?dates=20261015&limit=100',
 'europa-20261022':'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/scoreboard?dates=20261022&limit=100',
}
for name,url in sources.items():
 try:
  with urllib.request.urlopen(url,timeout=30) as r:data=json.load(r)
  capture={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':url,'data':data}
  (out/(name+'.json')).write_text(json.dumps(capture,ensure_ascii=False))
  print(name,json.dumps(data if name=='super-categories' else {'events':len(data.get('events',[]))},ensure_ascii=False))
 except urllib.error.HTTPError as e:
  print(name,'HTTP',e.code)
  (out/(name+'-error.json')).write_text(json.dumps({'url':url,'status':e.code}))
