"""Exact date/team/score joins; unknown price timing never promoted to executable odds."""
import json,datetime
from pathlib import Path
schedule=json.loads(Path('data/research-inputs/may-2026-schedule.json').read_text());source=json.loads(Path('data/research-inputs/may-2026-covers.json').read_text());idx={};candidates=0
for result in source['results']:
 for r in result['rows']:
  if not '2026-05-01'<=r['date']<='2026-05-31':continue
  candidates+=1;home=r['teamId'] if r['venue']=='home' else r['opponentId'];away=r['opponentId'] if r['venue']=='home' else r['teamId'];idx.setdefault((r['date'],home,away),[]).append(r)
fixtures=[g for d in schedule['dates'] for g in d['games'] if g['gameType']=='R' and g['status']['abstractGameState']=='Final'];keys={}
for g in fixtures: keys.setdefault((g['officialDate'],g['teams']['home']['team']['id'],g['teams']['away']['team']['id']),[]).append(g)
paired=[];excluded=[]
for key,gg in keys.items():
 if len(gg)!=1:
  excluded.extend({'gameId':g['gamePk'],'reason':'ambiguous_same_date_doubleheader'} for g in gg);continue
 g=gg[0];rows=idx.get(key,[])
 if any('score' not in g['teams'][s] for s in ['home','away']):excluded.append({'gameId':g['gamePk'],'reason':'missing_final_score'});continue
 hs=g['teams']['home']['score'];aws=g['teams']['away']['score']
 if not rows:excluded.append({'gameId':g['gamePk'],'reason':'missing_history'});continue
 if len(rows)!=2 or len(set(r['teamId'] for r in rows))!=2 or len(set(r['coversGameId'] for r in rows))!=1:excluded.append({'gameId':g['gamePk'],'reason':'non_unique_two_sided_join'});continue
 if any((r['scored'],r['allowed'])!=((hs,aws) if r['venue']=='home' else (aws,hs)) for r in rows):excluded.append({'gameId':g['gamePk'],'reason':'score_conflict'});continue
 if len(set(r['totalLine'] for r in rows))!=1 or any(not r['totalResultMatches'] for r in rows):excluded.append({'gameId':g['gamePk'],'reason':'total_conflict_or_missing'});continue
 paired.append({'gameId':g['gamePk'],'date':key[0],'homeId':key[1],'awayId':key[2],'result':{'home':hs,'away':aws},'totalLine':rows[0]['totalLine'],'moneylines':{r['venue']:r['moneylineAmerican'] for r in rows},'source':rows[0]['source'],'bookmaker':None,'priceTimestamp':None,'closingVerified':False,'totalPrice':None,'runLine':None,'pregameEligibilityVerified':False,'roiEligible':False})
sc=json.loads(Path('data/statcast-history.json').read_text());scids=set(g['gameId'] for g in sc['groups'])
for p in paired:p['hasStatcast']=p['gameId'] in scids
summary={'start':'2026-05-01','end':'2026-05-31','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceTeams':len(source['results']),'sourceErrors':source['errors'],'teamRows':candidates,'officialFinalGames':len(fixtures),'matchedGames':len(paired),'matchedStatcastGames':sum(p['hasStatcast'] for p in paired),'excludedGames':len(excluded),'roiEligibleGames':0,'status':'research_only','modelApplied':False,'limitations':['No bookmaker or price timestamp','Closing status and pregame availability unverified','No spread or total-market prices','Do not use archived quote availability as a pregame feature','May 2026 archive is separate from 2025 model holdout']}
Path('data/historical-odds.json').write_text(json.dumps({'summary':summary,'games':paired,'excluded':excluded},separators=(',',':')));print(json.dumps(summary))
