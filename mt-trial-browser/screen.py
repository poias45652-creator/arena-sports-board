"""An isolated MT guest screen. Only pixels and bounded pointer events leave a session."""
import asyncio
import base64
import hmac
import ipaddress
import math
import os
import re
import secrets
import time
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

from aiohttp import web, WSMsgType
from playwright.async_api import async_playwright

WIDTH, HEIGHT = 1024, 640
MAX_SESSIONS = 2
HOSTS = {"gs1.ofalive99.net", "gsa.ofalive99.net"}
ROOM = re.compile(r"BAV(?:0[1235](?:_LIVE)?|03A(?:_LIVE)?|0[6789]|10)")
html = Path(__file__).with_name("player.html").read_text()
sessions = {}
lock = asyncio.Lock()
browser = None
key = os.environ.get("MT_SCREEN_KEY", "")
origin = os.environ.get("RENDER_EXTERNAL_URL", "").rstrip("/")
site = "https://arena-sports-board.onrender.com"
brand = "https://xingzhun-sports-home.poias45652.chatgpt.site"


def same_ip(value):
    try:
        addr = ipaddress.ip_address(value or "")
        return str(getattr(addr, "ipv4_mapped", None) or addr)
    except ValueError:
        return None


def allowed(url):
    try:
        u = urlsplit(url)
        return (u.scheme == "https" and u.hostname in HOSTS and u.port in (443, None)
                and not u.username and not u.password and any(k.lower()=="token" and v for k,v in parse_qsl(u.query)))
    except ValueError:
        return False


async def start_session(request):
    if not hmac.compare_digest(request.headers.get("Authorization", ""), "Bearer " + key):
        raise web.HTTPForbidden()
    print("[MT screen] authorized request", flush=True)
    data = await request.json()
    ip = same_ip(data.get("ip"))
    url, room = data.get("url", ""), data.get("room")
    seconds = data.get("remaining")
    if not ip or not allowed(url) or (room is not None and not ROOM.fullmatch(room)) or type(seconds) not in (float, int) or not 0 < seconds <= 600:
        raise web.HTTPBadRequest()
    # Absolute expiry survives slow setup and retries for an already-active lease.
    deadline = time.monotonic() + seconds
    active = data.get("active") is True
    if active:
        expires=data.get("expiresAt")
        if type(expires) not in (int,float) or not math.isfinite(expires): raise web.HTTPBadRequest()
        deadline=min(deadline,time.monotonic()+expires/1000-time.time())
        if deadline<=time.monotonic(): raise web.HTTPGone()
    async with lock:
        session = next((s for s in sessions.values() if s.ip == ip and s.end > time.monotonic()), None)
        if not session:
            if len(sessions) >= MAX_SESSIONS:
                raise web.HTTPServiceUnavailable(text="busy")
            session = Screen(ip, deadline if active else time.monotonic()+630)
            sessions[session.id] = session
        if active:
            session.end = min(session.end, deadline)
    try:
        async with session.setup:
            if session.closed:
                raise web.HTTPGone()
            if not session.page:
                await session.open(url, room)
            elif room and room != session.room:
                await session.goto(url, room)
            elif data.get("lobby") is True and session.room:
                await session.goto(url, None)
            if session.end <= time.monotonic():
                raise web.HTTPGone()
        return web.json_response({"id":session.id})
    except web.HTTPException:
        raise
    except Exception as exc:
        # Never log provider URLs or tokens. Browser errors can embed both.
        error = re.search(r"net::[A-Z_]+",str(exc))
        print("[MT screen] failed", session.stage, type(exc).__name__, error[0] if error else (str(exc) if str(exc).startswith("provider_") else ""), flush=True)
        await session.close()
        raise web.HTTPServiceUnavailable(text="table unavailable")


class Screen:
    def __init__(self, ip, deadline):
        self.ip, self.end = ip, deadline
        self.id = secrets.token_hex(24)
        self.setup = asyncio.Lock()
        self.context = self.page = self.cdp = self.viewer = self.room = None
        self.closed = False
        self.stage = "new"
        self.seq = 0
        self.condition = asyncio.Condition()
        self.jpeg = None

    async def open(self, url, room):
        self.stage = "create context"
        self.context = await browser.new_context(viewport={"width":WIDTH, "height":HEIGHT},
            locale="zh-TW", accept_downloads=False, service_workers="block")
        self.page = await self.context.new_page()
        async def route(req):
            u = urlsplit(req.request.url)
            shell_url=site+"/mt-trial/renderer"
            if req.request.url==shell_url: return await req.continue_()
            if req.request.is_navigation_request() and u.hostname not in HOSTS and req.request.frame == self.page.main_frame:
                return await req.abort()
            if u.scheme in ("http", "https"):
                host = (u.hostname or "").lower()
                if "." not in host or host.endswith((".internal",".local",".localhost",".onrender.com")) or host in ("localhost","metadata.google.internal"):
                    return await req.abort()
                try:
                    if not ipaddress.ip_address(host).is_global: return await req.abort()
                except ValueError: pass
            await req.continue_()
        await self.context.route("**/*",route)
        self.context.on("page", lambda p: asyncio.create_task(p.close()) if p != self.page else None)
        self.cdp = await self.context.new_cdp_session(self.page)
        self.cdp.on("Page.screencastFrame", self.frame)
        self.stage = "first-party shell"
        response=await self.page.goto(site+"/mt-trial/renderer",wait_until="domcontentloaded",timeout=18000)
        if not response or response.status!=200: raise RuntimeError("missing renderer shell")
        await self.goto(url, room)
        self.stage = "capture"
        await self.cdp.send("Page.startScreencast",{"format":"jpeg","quality":74,"maxWidth":WIDTH,"maxHeight":HEIGHT,"everyNthFrame":2})
        image = await self.cdp.send("Page.captureScreenshot",{"format":"jpeg","quality":74})
        self.jpeg = base64.b64decode(image["data"])
        self.stage = "ready"
        print("[MT screen] first frame ready", flush=True)

    async def goto(self,url,room):
        from urllib.parse import urlunsplit
        u=urlsplit(url)
        # Preserve the signed launch URL byte-for-byte unless a table change is requested.
        if room:
            params=[pair for pair in u.query.split("&") if pair.split("=",1)[0].lower()!="game"]
            url=urlunsplit(u._replace(query="&".join([*params,"game="+room])))
        self.stage = "native iframe"
        def is_table_document(r):
            return (r.request.is_navigation_request() and urlsplit(r.url).hostname in HOSTS
                    and not 300<=r.status<400)
        async with self.page.expect_response(is_table_document,timeout=20000) as event:
            await self.page.locator("iframe").evaluate("(f,src)=>{f.src=src}",url)
        response=await event.value
        print("[MT screen] navigation HTTP", response.status if response else 0, flush=True)
        if response and response.status==403:
            try:
                html=(await asyncio.wait_for(response.text(),3))[:65536].lower()
                if any(x in html for x in ("not available in your country","block access from your country","restricted region","country is blocked")): reason="regional restriction"
                elif any(x in html for x in ("verify you are human","cf-chl-","challenge-platform","checking your browser")): reason="browser verification"
                elif "access denied" in html: reason="access denied"
                else: reason="unspecified"
                print("[MT screen] provider refusal:",reason,flush=True)
            except Exception: pass
        if not response or response.status>=400 or urlsplit(response.url).hostname not in HOSTS:
            raise RuntimeError("provider_http_"+str(response.status) if response else "provider_no_response")
        self.room=room

    async def frame(self,event):
        if self.closed or time.monotonic()>=self.end: return
        await self.cdp.send("Page.screencastFrameAck",{"sessionId":event["sessionId"]})
        self.jpeg=base64.b64decode(event["data"])
        async with self.condition:
            self.seq+=1
            self.condition.notify_all()

    async def close(self):
        if self.closed: return
        self.closed=True
        sessions.pop(self.id,None)
        async with self.condition: self.condition.notify_all()
        if self.viewer: await self.viewer.close(code=1008)
        if self.context:
            try: await self.context.close()
            except Exception: pass


def get_session(request):
    s=sessions.get(request.match_info["id"])
    if not s or s.end<=time.monotonic() or s.closed: raise web.HTTPGone()
    if same_ip(request.headers.get("cf-connecting-ip"))!=s.ip: raise web.HTTPForbidden()
    return s


async def view(request):
    get_session(request)
    return web.Response(text=html,content_type="text/html")


async def live(request):
    s=get_session(request)
    if request.headers.get("Origin")!=origin: raise web.HTTPForbidden()
    ws=web.WebSocketResponse(max_msg_size=512,heartbeat=20)
    if s.viewer: await s.viewer.close(code=1001)
    s.viewer=ws
    await ws.prepare(request)
    async def send_frames():
        last=-1
        while not s.closed and s.end>time.monotonic():
            if s.jpeg and last!=s.seq:
                last=s.seq
                await ws.send_bytes(s.jpeg)
            async with s.condition:
                try: await asyncio.wait_for(s.condition.wait(),min(1,max(.01,s.end-time.monotonic())))
                except asyncio.TimeoutError: pass
            await asyncio.sleep(.055)
    async def inputs():
        import json
        async for message in ws:
            if time.monotonic()>=s.end or s.closed: return
            if message.type!=WSMsgType.TEXT: return
            try:
                e=json.loads(message.data)
                x,y=e["x"],e["y"]
                if type(x) not in (int,float) or type(y) not in (int,float) or not (0<=x<=1 and 0<=y<=1): continue
                if e.get("type")=="click":
                    await s.page.mouse.click(x*(WIDTH-1),y*(HEIGHT-1))
                elif e.get("type")=="wheel":
                    delta=e.get("delta")
                    if type(delta) in (int,float) and math.isfinite(delta):
                        await s.page.mouse.move(x*(WIDTH-1),y*(HEIGHT-1))
                        await s.page.mouse.wheel(0,max(-640,min(640,delta)))
            except (KeyError,ValueError,TypeError): continue
    tasks=[asyncio.create_task(f()) for f in (send_frames,inputs)]
    try: await asyncio.wait(tasks,return_when=asyncio.FIRST_COMPLETED)
    finally:
        for task in tasks: task.cancel()
        await asyncio.gather(*tasks,return_exceptions=True)
        if s.viewer is ws: s.viewer=None
        await ws.close()
    return ws


async def lifecycle(app):
    global browser
    if len(key)<32: raise RuntimeError("missing relay authentication")
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path="/usr/bin/chromium",headless=True,
            env={"HOME":os.environ["HOME"],"PATH":"/usr/bin:/bin","LANG":"C.UTF-8"},
            args=["--disable-dev-shm-usage","--autoplay-policy=no-user-gesture-required","--enable-unsafe-swiftshader"])
        async def cleanup():
            while True:
                await asyncio.sleep(.25)
                await asyncio.gather(*(s.close() for s in list(sessions.values()) if s.end<=time.monotonic()),return_exceptions=True)
        task=asyncio.create_task(cleanup())
        try: yield
        finally:
            task.cancel()
            await asyncio.gather(task,return_exceptions=True)
            await asyncio.gather(*(s.close() for s in list(sessions.values())),return_exceptions=True)
            await browser.close()


app=web.Application(client_max_size=8192)
async def response_headers(request,response):
    response.headers.update({"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff",
        "Content-Security-Policy":f"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob:; connect-src 'self' wss://{urlsplit(origin).netloc}; frame-ancestors {site} {brand} https://chatgpt.com; base-uri 'none'; form-action 'none'"})
app.on_response_prepare.append(response_headers)
app.cleanup_ctx.append(lifecycle)
async def health(request): return web.json_response({"ready":bool(browser and browser.is_connected())})
app.router.add_get("/",health)
app.router.add_post("/sessions",start_session)
app.router.add_get("/s/{id:[a-f0-9]+}",view)
app.router.add_get("/s/{id:[a-f0-9]+}/live",live)
if __name__=="__main__":
    web.run_app(app,port=int(os.environ.get("PORT","10000")),access_log=None)
