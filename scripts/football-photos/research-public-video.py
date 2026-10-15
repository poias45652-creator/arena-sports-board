"""Inspect one public match video. No authentication, retries or bypasses."""
import pathlib, subprocess, json
root=pathlib.Path('/tmp/europa-gaps/video');root.mkdir(parents=True,exist_ok=True)
url='https://www.youtube.com/watch?v=Z21x4BLOMEk'
cmd=['python','-m','yt_dlp','--no-playlist','--retries','0','--fragment-retries','0','--socket-timeout','20','--max-filesize','80M','--match-filter','duration <= 600','-f','best[height<=720]/best','--write-info-json','-o',str(root/'match.%(ext)s'),url]
p=subprocess.run(cmd,capture_output=True,text=True,timeout=180)
(root/'download-log.json').write_text(json.dumps({'url':url,'returncode':p.returncode,'stdout':p.stdout,'stderr':p.stderr},indent=2))
for video in list(root.glob('match.*')):
 if video.suffix not in ['.mp4','.webm','.mkv']:continue
 result=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(video),'-vf','fps=1/4','-q:v','2',str(root/'frame-%03d.jpg')],capture_output=True,text=True,timeout=90)
 (root/'frames-log.txt').write_text(result.stderr)
 video.unlink()
