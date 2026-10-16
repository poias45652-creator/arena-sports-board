"""Build a seamless 8-second desktop GIF from the approved artwork.

Usage: python scripts/animate-login-background.py INPUT OUTPUT [--preview]
Pillow/numpy render motion with a fixed GIF palette; ffmpeg writes a review MP4.
"""
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

source, output = map(Path, sys.argv[1:3])
preview = '--preview' in sys.argv
W, H, FPS, N = 1440, 810, 12.5, 100
base = Image.open(source).convert('RGB').resize((W, H), Image.Resampling.LANCZOS)
output.parent.mkdir(parents=True, exist_ok=True)
base.save(output.with_suffix('.webp'), quality=92)
y, x = np.mgrid[0:H, 0:W].astype(np.float32)
xn, yn = x / W, y / H
# Keep the emblem, foreground balls and (in a preview) all form controls still.
weight = np.ones((H, W), dtype=np.float32)
weight *= 1 - np.exp(-(((xn-.5)/.12)**8 + ((yn-.20)/.17)**8))
weight *= np.clip((.83-yn)/.18, 0, 1)
weight *= 1 - .75*np.exp(-(((xn-.15)/.16)**6 + ((yn-.25)/.23)**6))
if preview:
    protected = Image.new('L', (W,H), 0)
    ImageDraw.Draw(protected).rounded_rectangle((.365*W,.315*H,.635*W,.89*H), radius=20, fill=255)
    protection = np.asarray(protected.filter(ImageFilter.GaussianBlur(5)), dtype=np.float32)/255
    weight *= 1-protection
else:
    protection = np.zeros((H,W), dtype=np.float32)
mask = Image.fromarray(np.uint8(np.clip(weight,0,1)*255))
rgb = np.asarray(base, dtype=np.float32)
cloud = np.clip((rgb[:,:,2]-rgb[:,:,0]-9)/45,0,1) * np.clip((rgb.mean(axis=2)-18)/45,0,1)
weight *= cloud
mask = Image.fromarray(np.uint8(np.clip(weight,0,1)*255))
palette = base.quantize(colors=256)
frames = []
rng = np.random.default_rng(161026)
stars = [(float(rng.uniform(.025,.975)),float(rng.uniform(.025,.92)),float(rng.uniform(0,2*math.pi)),float(rng.uniform(.6,1.5))) for _ in range(45)]
stars = [s for s in stars if not (.36<s[0]<.64 and .02<s[1]<.91)]
particles = [(float(rng.uniform(0,1)),float(rng.uniform(0,1)),float(rng.uniform(0,2*math.pi))) for _ in range(48)]
movie = output.with_suffix('.mp4')
encoder = subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p',str(movie)], stdin=subprocess.PIPE)
for frame in range(N):
    t = 2*math.pi*frame/N
    mesh=[]
    for gy in range(0,H,54):
        for gx in range(0,W,60):
            right,bottom=min(gx+60,W),min(gy+54,H)
            quad=[]
            for px,py in [(gx,gy),(gx,bottom),(right,bottom),(right,gy)]:
                dx=4.5*math.sin(t+py/H*4)+2*math.sin(2*t+px/W*3)
                dy=3.5*math.cos(t+px/W*4)
                quad.extend((px+dx,py+dy))
            mesh.append(((gx,gy,right,bottom),tuple(quad)))
    drift = base.transform((W,H),Image.Transform.MESH,mesh,Image.Resampling.BICUBIC)
    composed = Image.composite(drift,base,mask)
    arr=np.array(composed,dtype=np.float32)
    # Very soft moving cloud illumination, fully periodic.
    illumination=(.035*np.sin(t+xn*8+yn*3)+.025*np.cos(2*t-xn*5+yn*7))*weight
    arr*=1+illumination[:,:,None]
    light=Image.new('RGB',(W,H))
    d=ImageDraw.Draw(light)
    for sx,sy,phase,size in stars:
        pulse=(.5+.5*math.sin(t+phase))**3
        a=int(165*pulse)
        cx,cy=int(sx*W),int(sy*H)
        r=max(1,int(size*(1+3*pulse)))
        d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=(a,int(a*.78),int(a*.42)))
        if pulse>.4:
            d.line((cx-r*3,cy,cx+r*3,cy),fill=(a//2,a//3,a//5),width=1)
            d.line((cx,cy-r*3,cx,cy+r*3),fill=(a//2,a//3,a//5),width=1)
    for px,py,phase in particles:
        cx=(px+.018*math.sin(t+phase))*W
        cy=(py+.035*math.cos(t+phase))*H
        if .35*W<cx<.65*W and .02*H<cy<.91*H:
            continue
        alpha=int(85*(.5+.5*math.sin(t+phase))**2)
        d.ellipse((cx-1,cy-1,cx+1,cy+1),fill=(alpha,int(alpha*.73),int(alpha*.3)))
    glow=np.array(light.filter(ImageFilter.GaussianBlur(3)),dtype=np.float32)*.7
    arr+=np.array(light,dtype=np.float32)+glow
    rendered = Image.fromarray(np.uint8(np.clip(arr,0,255)))
    frames.append(rendered.quantize(palette=palette,dither=Image.Dither.NONE))
    encoder.stdin.write(rendered.tobytes())
    if frame%30==0:
        print(f'{output.name}: {frame}/{N}',flush=True)
encoder.stdin.close()
if encoder.wait():
    raise RuntimeError('Video encoding failed')
frames[0].save(output,save_all=True,append_images=frames[1:],duration=80,loop=0,disposal=1,optimize=True)
print(f'{output}: {output.stat().st_size} bytes',flush=True)
