"""Partition daily CSVs into server assets; compact manifest preserves cutoff-aware summaries."""
import csv,json,hashlib,datetime,sys,math
from pathlib import Path
cache=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp')
old=json.loads(Path('data/statcast-history.json').read_text()); meta=old['metadata'];columns=meta['columns'];labels=meta['outcomeColumns']; strings={'game_date','home_team','away_team','game_type','pitch_type','pitch_name','p_throws','stand','inning_topbot','events','description'}
out=Path('public/history/statcast');out.mkdir(parents=True,exist_ok=True);days=[];allgames=set();bydate={};groups=[];miss={k:0 for k in ['pitch_type','release_speed','release_spin_rate']}
for d in range(1,32):
 day=f'2026-05-{d:02}';p=cache/('arena-statcast-sample.csv' if d==1 else f'arena-statcast-{day}.csv');raw=p.read_bytes();rows=[];seen=set();gg={}
 for r in csv.DictReader(raw.decode('utf-8-sig').splitlines()):
  assert r['game_date'][:10]==day
  key=tuple(r[k] for k in ['game_pk','at_bat_number','pitch_number']);assert all(key) and key not in seen;seen.add(key)
  row=[None if r[k]=='' else r[k] if k in strings else float(r[k]) for k in columns];assert all(not isinstance(v,float) or math.isfinite(v) for v in row);rows.append(row)
  pk=int(float(r['game_pk']));pid=int(float(r['pitcher']));pt=r['pitch_type'] or 'unknown';allgames.add(pk);g=gg.setdefault((pk,pid,pt),{'date':day,'gameId':pk,'pitcherId':pid,'pitchType':pt,'records':0,'speedN':0,'speedSum':0,'spinN':0,'spinSum':0});g['records']+=1
  for col,k in [('release_speed','speed'),('release_spin_rate','spin')]:
   if r[col]:g[k+'N']+=1;g[k+'Sum']+=float(r[col])
  for k in miss:miss[k]+=int(not r[k])
 rows.sort(key=lambda r:(r[1],r[2],r[3]));asset=out/(day+'.json');text=json.dumps(rows,separators=(',',':'),ensure_ascii=False);asset.write_text(text);days.append({'date':day,'records':len(rows),'path':'/history/statcast/'+asset.name,'csvSha256':hashlib.sha256(raw).hexdigest(),'assetSha256':hashlib.sha256(text.encode()).hexdigest()});bydate[day]=len(rows);groups.extend(gg.values())
meta.update({'preparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'end':'2026-05-31','records':sum(bydate.values()),'games':len(allgames),'byDate':bydate,'missing':miss,'storage':'daily JSON assets; columns in manifest','csvSha256':None,'days':days})
Path('data/statcast-history.json').write_text(json.dumps({'metadata':meta,'groups':groups},separators=(',',':'),ensure_ascii=False))
print(json.dumps({'records':meta['records'],'games':meta['games'],'days':len(days),'groups':len(groups),'missing':miss}))
