"""Run in a Python environment with pybaseball==2.2.7 and pandas. Public, bounded daily requests."""
import concurrent.futures,warnings,sys
from pathlib import Path
import requests,pandas as pd
from pybaseball import statcast
warnings.simplefilter('ignore',FutureWarning)
root=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp');root.mkdir(parents=True,exist_ok=True)
original=requests.sessions.Session.request
def bounded(self,method,url,**kwargs):
 kwargs.setdefault('timeout',50);response=original(self,method,url,**kwargs);response.raise_for_status();return response
requests.sessions.Session.request=bounded
def run(day):
 path=root/('arena-statcast-sample.csv' if day=='2026-05-01' else f'arena-statcast-{day}.csv')
 d=pd.read_csv(path,low_memory=False) if path.exists() else statcast(start_dt=day,end_dt=day,parallel=False,verbose=False)
 assert not d.empty and set(pd.to_datetime(d.game_date).dt.strftime('%Y-%m-%d'))=={day}
 assert not d.duplicated(['game_pk','at_bat_number','pitch_number']).any()
 if not path.exists():d.to_csv(path,index=False)
 print(day,len(d),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(run,[f'2026-05-{i:02}' for i in range(1,32)]))
