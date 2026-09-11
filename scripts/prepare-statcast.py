"""Prepare compact historical Statcast records from the downloaded CSV; original CSV stays intact."""
import csv,json,hashlib,datetime,sys
from pathlib import Path
path=Path(sys.argv[1]);raw=path.read_bytes();reader=csv.DictReader(raw.decode('utf-8-sig').splitlines())
ident=['game_date','game_pk','at_bat_number','pitch_number','pitcher','batter','home_team','away_team','game_type']
observed=['pitch_type','pitch_name','release_speed','release_spin_rate','release_extension','p_throws','stand','pfx_x','pfx_z','plate_x','plate_z','balls','strikes','outs_when_up','inning','inning_topbot','on_1b','on_2b','on_3b']
labels=['events','description','launch_speed','launch_angle','hit_distance_sc','estimated_woba_using_speedangle','woba_value','post_home_score','post_away_score']
columns=ident+observed+labels
strings={'game_date','home_team','away_team','game_type','pitch_type','pitch_name','p_throws','stand','inning_topbot','events','description'}
rows=[];seen=set();byday={}
for r in reader:
 key=tuple(r[k] for k in ['game_pk','at_bat_number','pitch_number']);assert all(key) and key not in seen;seen.add(key)
 date=r['game_date'][:10];assert '2026-05-01'<=date<='2026-05-07';byday[date]=byday.get(date,0)+1
 row=[]
 for k in columns:
  v=r[k];row.append(None if v=='' else v if k in strings else float(v))
 rows.append(row)
metadata={'source':'https://baseballsavant.mlb.com/statcast_search','method':'pybaseball.statcast 2.2.7; daily queries','preparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceUpdatedAt':None,'csvSha256':hashlib.sha256(raw).hexdigest(),'start':'2026-05-01','end':'2026-05-07','records':len(rows),'games':len(set(r[1] for r in rows)),'byDate':byday,'columns':columns,'outcomeColumns':labels,'excludedFutureColumns':['pitcher_days_until_next_game','batter_days_until_next_game'],'scope':'historical pitch/event records; subset of original CSV columns; not live or model-ready','modelApplied':False}
Path('data/statcast-history.json').write_text(json.dumps({'metadata':metadata,'rows':rows},ensure_ascii=False,separators=(',',':')))
print(json.dumps({'records':len(rows),'games':metadata['games'],'columns':len(columns),'bytes':Path('data/statcast-history.json').stat().st_size}))
